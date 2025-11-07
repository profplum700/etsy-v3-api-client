const table = (data, config) => {
  // Simple mock implementation that returns a basic table string
  if (!data || data.length === 0) return '';

  const headers = data[0];
  const rows = data.slice(1);

  let result = headers.join(' | ') + '\n';
  result += headers.map(() => '---').join(' | ') + '\n';
  rows.forEach(row => {
    result += row.join(' | ') + '\n';
  });

  return result;
};

module.exports = { table };
module.exports.default = { table };
