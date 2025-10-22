// backend/src/mw/rbac.js
const isAdmin   = (me) => !!me?.isAdmin || String(me?.role).toUpperCase() === 'ADMIN';
const isOwner   = (me) => !!me?.isOwner || String(me?.role).toUpperCase() === 'OWNER';
const isManager = (me) => !!me?.isManager || String(me?.role).toUpperCase() === 'MANAGER';

module.exports = { isAdmin, isOwner, isManager };
