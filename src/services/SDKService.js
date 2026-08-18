
export class SDKService {
  constructor() {
    this.listeners = {};
    this.stats = { enqueued: 0, processed: 0, failed: 0 };
    this.activeTasks = [];
    this.ws = null;
    this.isPolling = false;
    this.pollInterval = null;
    this.progressPollInterval = null;
    this.lastProgressTs = Date.now() / 1000;

    this.connect();
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    
    // Initial emit
    if (event === 'stats') callback(this.stats);
    if (event === 'tasks') callback(this.activeTasks);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // When running locally in Vite dev mode, we need a hardcoded port or we use the host
    const wsUrl = process.env.NODE_ENV === 'development' 
        ? 'ws://127.0.0.1:8080/ws' 
        : `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
        console.log('[Snerd] WebSocket connected.');
        this.fetchData(); // Fetch initial state
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.isPolling = false;
        }
        // Even with WS, we poll stats/tasks every 5s just to keep UI fresh
        // because SnerdMQ WS currently only sends 'progress' events.
        this.startPolling(5000);
    };

    this.ws.onmessage = (e) => {
        try {
            const msg = JSON.parse(e.data);
            if (msg.action === 'progress') {
                this.emit('progress', {
                    task_id: msg.task_id,
                    data: typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data)
                });
            }
        } catch(err) {
            console.error('Failed to parse WS message', err);
        }
    };

    this.ws.onerror = () => {
        console.warn('[Snerd] WebSocket error. Falling back to HTTP polling.');
        this.fallbackToPolling();
    };

    this.ws.onclose = () => {
        console.warn('[Snerd] WebSocket closed. Falling back to HTTP polling.');
        this.fallbackToPolling();
    };
  }

  fallbackToPolling() {
      if (this.isPolling) return;
      console.log('[Snerd] Initiating fallback HTTP polling...');
      this.isPolling = true;
      this.startPolling(2000);
  }

  startPolling(interval) {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.pollInterval = setInterval(() => {
          this.fetchData();
      }, interval);
      this.fetchData();

      // For SDKs without WebSocket support (e.g. PHP, Ruby), progress events
      // are persisted to a file and exposed via /api/progress. Poll it when the
      // WS connection is not delivering events.
      if (!this.progressPollInterval) {
          this.progressPollInterval = setInterval(() => this.pollProgress(), 2000);
      }
  }

  async pollProgress() {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8080' : '';
      try {
          const res = await fetch(`${baseUrl}/api/progress`);
          if (!res.ok) return;
          const events = await res.json();
          if (!Array.isArray(events)) return;
          events.forEach(ev => {
              if (ev.ts > this.lastProgressTs) {
                  this.lastProgressTs = ev.ts;
                  this.emit('progress', {
                      task_id: ev.task_id,
                      data: typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)
                  });
              }
          });
      } catch (err) {
          // Endpoint may not exist on some SDKs; ignore silently
      }
  }

  async fetchData() {
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8080' : '';
      try {
          const [statsRes, tasksRes] = await Promise.all([
              fetch(`${baseUrl}/api/stats`),
              fetch(`${baseUrl}/api/tasks`)
          ]);

          if (statsRes.ok) {
              const stats = await statsRes.json();
              this.stats = stats;
              this.emit('stats', this.stats);
          }

          if (tasksRes.ok) {
              const tasks = await tasksRes.json();
              tasks.forEach(t => {
                  if (t.status === 'failed' && t.retryCount >= t.maxRetries) {
                      t.status = 'dead_letter';
                  }
              });
              this.activeTasks = tasks;
              this.emit('tasks', this.activeTasks);
          }
      } catch (err) {
          console.error('[Snerd] Polling failed', err);
      }
  }
}
