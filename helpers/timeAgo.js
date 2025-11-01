const { formatDistanceToNowStrict } = require('date-fns');

const timeAgo = (date) => {
  if (!date) return null;
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
  } catch (e) {
    return null;
  }
};

module.exports = timeAgo;
