
import React, { useState, useEffect } from 'react';
import logo from './assets/logo.png';
//, { useState, useEffect, useRef } from 'react'
import { Activity, Database, Terminal, Cpu, Sun, Moon, Filter } from 'lucide-react'
import { SDKService } from './services/SDKService'
import './index.css'

const sdk = new SDKService();

function App() {
  const [stats, setStats] = useState(sdk.stats);
  const [tasks, setTasks] = useState(sdk.activeTasks);
  const [logs, setLogs] = useState([]);
  const [theme, setTheme] = useState('dark');
  const [filter, setFilter] = useState('all'); // all, active, queued, completed, failed
  const consoleRef = useRef(null);

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-mode' : '';
  }, [theme]);

  useEffect(() => {
    sdk.on('stats', setStats);
    sdk.on('tasks', setTasks);
    sdk.on('progress', (msg) => {
      setLogs(prev => {
        const newLogs = [...prev, { time: new Date().toLocaleTimeString(), ...msg }];
        return newLogs.slice(-50); // Keep last 50
      });
    });
  }, []);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  };

  const filteredTasks = tasks.filter(t => filter === 'all' || t.status === filter);

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>
          <Cpu style={{color: 'var(--accent)'}} size={28} /> 
          SnerdMQ Dashboard
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
            <span className="pulsing-dot"></span> System Online
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>

      <div className="grid-layout">
        {/* Left Column: Queues & Tasks */}
        <div>
          <div className="glass-panel" style={{marginBottom: '1.5rem'}}>
            <div className="panel-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} /> Queue Health
              </span>
            </div>
            <div className="panel-content">
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-value">{stats.enqueued}</div>
                  <div className="stat-label">Total Enqueued</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.processed}</div>
                  <div className="stat-label">Processed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{color: 'var(--error)'}}>{stats.failed}</div>
                  <div className="stat-label">Failed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{color: 'var(--success)'}}>{tasks.filter(t => t.status === 'active').length}</div>
                  <div className="stat-label">Active Workers</div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} /> Recent Jobs
              </span>
              <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Jobs</option>
                <option value="active">Active</option>
                <option value="queued">Queued</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="dead_letter">Dead Letter</option>
              </select>
            </div>
            <div className="panel-content">
              <table>
                <thead>
                  <tr>
                    <th>Task ID</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(t => (
                    <tr key={t.id}>
                      <td style={{fontFamily: 'monospace', color: 'var(--text-secondary)'}}>{t.id}</td>
                      <td>{t.type}</td>
                      <td>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start'}}>
                          <span className={`badge badge-${t.status}`}>
                            {t.status === 'dead_letter' ? 'DEAD LETTER' : t.status.toUpperCase()}
                          </span>
                          {t.status === 'failed' && t.retryCount < t.maxRetries && (
                            <span style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>
                              Retry {t.retryCount}/{t.maxRetries} at {new Date(t.retryAfterTime).toLocaleTimeString()}
                            </span>
                          )}
                          {t.status === 'dead_letter' && (
                            <span style={{fontSize: '0.7rem', color: 'var(--error)'}}>
                              Permanently Failed
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{width: '100%', background: 'rgba(128,128,128,0.2)', height: '6px', borderRadius: '3px', overflow: 'hidden'}}>
                          <div style={{
                            width: `${t.progress}%`, 
                            background: (t.status === 'failed' || t.status === 'dead_letter') ? 'var(--error)' : t.status === 'completed' ? 'var(--success)' : 'var(--accent)', 
                            height: '100%', transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0'}}>No jobs match this filter</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Progress Stream */}
        <div>
          <div className="glass-panel" style={{height: '100%'}}>
            <div className="panel-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={18} /> Real-time Progress Stream
              </span>
            </div>
            <div className="panel-content">
              <div className="console" ref={consoleRef}>
                {logs.length === 0 ? (
                  <div style={{color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem'}}>
                    Waiting for progress events...
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="console-line">
                      <span className="console-time">[{log.time}]</span>
                      <span className="console-task">[{log.task_id}]</span>
                      <span className="console-data">{log.data}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
