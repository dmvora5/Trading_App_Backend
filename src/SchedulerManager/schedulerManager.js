// schedulerManager.js
const { JobScheduler } = require("technical-strategies");

class SchedulerManager {
    constructor() {
        this.jobs = {};
    }

    addJob(name, options) {
        if (this.jobs[name]) {
            throw new Error(`Job with name ${name} already exists.`);
        }
        this.jobs[name] = new JobScheduler(options);
        console.log(`Job ${name} added.`);
    }

    removeJob(name) {
        if (!this.jobs[name]) {
            throw new Error(`Job with name ${name} does not exist.`);
        }
        this.jobs[name].cancelJob();
        delete this.jobs[name];
        console.log(`Job ${name} removed.`);
    }

    listJobs() {
        return Object.keys(this.jobs);
    }
}

const instance = new SchedulerManager();
Object.freeze(instance);

module.exports = instance;
