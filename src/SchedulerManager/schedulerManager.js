// schedulerManager.js
const { JobScheduler } = require("technical-strategies");

class SchedulerManager {
    constructor() {
        this.jobs = {};
        this.jobGroups = {};
    }

    addJob(name, options) {
        if (this.jobs[name]) {
            throw new Error(`Job with name ${name} already exists.`);
        }
        this.jobs[name] = new JobScheduler(options);
        console.log(`Job ${name} added.`);
    }

    addJobGroup(groupName, jobDetails) {
        if (this.jobGroups[groupName]) {
            throw new Error(`Job group with name ${groupName} already exists.`);
        }
        this.jobGroups[groupName]  = jobDetails.map(({ name, options }) => {
            const job = new JobScheduler(options);
            return job;
        });

       
        console.log(`Job group ${groupName} added with ${jobDetails.length} jobs.`);
    }

    removeJob(name) {
        const job = this.jobs[name];
        if (!job) {
            return;
        }
        job.cancelJob();
        delete this.jobs[name];
        console.log(`Job ${name} removed.`);
    }

    removeJobGroup(groupName) {
        const jobGroup = this.jobGroups[groupName];
        if (!jobGroup) {
            return;
        }
        jobGroup.forEach(job => {
            job.cancelJob();
        });
        delete this.jobGroups[groupName];
        console.log(`Job group ${groupName} and all its jobs removed.`);
    }

    listJobs() {
        return [...Object.keys(this.jobs), ...Object.keys(this.jobGroups)];
    }

    listJobGroups() {
        return Object.keys(this.jobGroups);
    }
}

const instance = new SchedulerManager();
Object.freeze(instance);

module.exports = instance;
