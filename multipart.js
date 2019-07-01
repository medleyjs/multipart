'use strict';

const makeHook = require('./lib/makeHook');

function multipart(app, options) {
  const globalOpts = options || {};

  app.decorateRequest('files', undefined);

  // eslint-disable-next-line no-shadow
  app.decorate('multipart', function multipart(expectedFiles, opts) {
    const {fileLimits, requiredFiles} = formatExpectedFiles(expectedFiles);

    opts = Object.assign({preservePath: globalOpts.preservePath}, opts, {
      limits: Object.assign({}, globalOpts.limits, opts && opts.limits),
    });

    return makeHook(fileLimits, requiredFiles, opts);
  });
}

function formatExpectedFiles(expectedFiles) {
  if (expectedFiles === undefined) {
    throw new TypeError('The `expectedFiles` option is required');
  }

  if (expectedFiles === 'ANY_FILES') {
    return {fileLimits: null, requiredFiles: []};
  }

  if (typeof expectedFiles !== 'object' || expectedFiles === null) {
    throw new TypeError(
      '`expectedFiles` must be an object or "ANY_FILES". Received: ' + JSON.stringify(expectedFiles)
    );
  }

  const fileLimits = {};
  const requiredFiles = [];

  Object.keys(expectedFiles).forEach((fieldName) => {
    const file = expectedFiles[fieldName];

    if (typeof file === 'number' && Number.isInteger(file)) {
      fileLimits[fieldName] = file;
      requiredFiles.push(fieldName);
    } else if (typeof file === 'object' && file !== null) {
      if (typeof file.maxCount !== 'number' || !Number.isInteger(file.maxCount)) {
        throw new TypeError(
          'expectedFiles object values must have a `maxCount` property that is an integer. ' +
          'Received: ' + JSON.stringify(file)
        );
      }

      fileLimits[fieldName] = file.maxCount;
      if (file.optional !== true) {
        requiredFiles.push(fieldName);
      }
    } else {
      throw new TypeError(
        'expectedFiles values must be an integer or an object. Received: ' + JSON.stringify(file)
      );
    }
  });

  return {fileLimits, requiredFiles};
}

multipart.discardFiles = function discardFiles(files) {
  for (const fieldName in files) {
    const file = files[fieldName];

    if (Array.isArray(file)) {
      file.forEach(f => f.stream.destroy());
    } else {
      file.stream.destroy();
    }
  }
};

multipart.MultipartError = require('./lib/MultipartError');

module.exports = multipart;
