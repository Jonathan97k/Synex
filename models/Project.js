const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name:   { type: String, required: true, trim: true },
    owner:  { type: String, required: true, trim: true },  // GitHub username/org, e.g. "Jonathan97k"
    repo:   { type: String, required: true, trim: true },  // repo name, e.g. "Enifa-website"
    branch: { type: String, default: 'main', trim: true },
    notes:  { type: String, default: '' }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Project', ProjectSchema);
