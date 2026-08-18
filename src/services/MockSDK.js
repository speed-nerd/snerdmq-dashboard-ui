
export class MockSDKService {
  constructor() {
    this.listeners = {};
    const futureTime = new Date();
    futureTime.setSeconds(futureTime.getSeconds() + 120);

    this.activeTasks = [
      { id: 'task-8fa2', type: 'ai_gen', status: 'active', progress: 45, retryCount: 0, maxRetries: 3, cronExpression: '*/5 * * * *' },
      { id: 'task-b91c', type: 'email_send', status: 'queued', progress: 0, retryCount: 0, maxRetries: 5, webhookUrl: 'https://hooks.example.com/notify' },
      { id: 'task-11x9', type: 'image_process', status: 'completed', progress: 100, retryCount: 0, maxRetries: 3, maxExecutionSeconds: 300 },
      { id: 'task-77f1', type: 'db_sync', status: 'failed', progress: 14, retryCount: 1, maxRetries: 3, retryAfterTime: futureTime.toISOString(), cronExpression: '0 */2 * * *' },
      { id: 'task-9x88', type: 'payment', status: 'failed', progress: 50, retryCount: 3, maxRetries: 3, webhookUrl: 'https://hooks.example.com/payment', maxExecutionSeconds: 60, cronExpression: '0 * * * *' },
    ];
    this.stats = {
      enqueued: 1204,
      processed: 1198,
      failed: 3
    };
    
    this.startSimulation();
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  startSimulation() {
    setInterval(() => {
      const active = this.activeTasks.filter(t => t.status === 'active');
      if (active.length > 0) {
        const randomTask = active[Math.floor(Math.random() * active.length)];
        const chunks = ["generating token...", "processing layer 2...", "compressing output...", "connecting to db..."];
        this.emit('progress', {
          task_id: randomTask.id,
          data: chunks[Math.floor(Math.random() * chunks.length)]
        });
      }
    }, 800);

    setInterval(() => {
      let madeChanges = false;
      this.activeTasks = this.activeTasks.map(t => {
        if (t.status === 'active') {
          t.progress = Math.min(100, t.progress + Math.floor(Math.random() * 20));
          madeChanges = true;
          
          if (t.progress === 100) {
            t.status = 'completed';
            this.stats.processed += 1;
          } else if (Math.random() > 0.95) {
            t.status = 'failed';
            t.retryCount = (t.retryCount || 0) + 1;
            
            if (t.retryCount >= t.maxRetries) {
               this.stats.failed += 1;
            } else {
               const retryTime = new Date();
               retryTime.setSeconds(retryTime.getSeconds() + 15);
               t.retryAfterTime = retryTime.toISOString();
            }
          }
        }
        return t;
      });

      if (this.activeTasks.length > 10) {
        const completeds = this.activeTasks.filter(t => t.status === 'completed' || (t.status === 'failed' && t.retryCount >= t.maxRetries));
        if (completeds.length > 5) {
          const toRemove = completeds[0].id;
          this.activeTasks = this.activeTasks.filter(t => t.id !== toRemove);
        }
      }
      
      if (Math.random() > 0.6) {
        this.activeTasks.unshift({
          id: 'task-' + Math.random().toString(36).substr(2, 4),
          type: ['ai_gen', 'email_send', 'db_sync'][Math.floor(Math.random() * 3)],
          status: 'queued',
          progress: 0,
          retryCount: 0,
          maxRetries: 3
        });
        this.stats.enqueued += 1;
        madeChanges = true;
      }
      
      this.activeTasks.forEach(t => {
        if (t.status === 'queued' && Math.random() > 0.6) {
           t.status = 'active';
           madeChanges = true;
        }
      });

      if (madeChanges) {
        this.emit('stats', { ...this.stats });
        this.emit('tasks', [...this.activeTasks]);
      }
    }, 2000);
  }
}
