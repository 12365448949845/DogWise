const success = (res, data = null, message = 'Success', code = 200) => {
  return res.status(code).json({
    code,
    message,
    data,
    timestamp: Date.now(),
  });
};

const fail = (res, message = 'Error', code = 400, data = null) => {
  return res.status(code).json({
    code,
    message,
    data,
    timestamp: Date.now(),
  });
};

module.exports = { success, fail };
