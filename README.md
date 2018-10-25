# @medley/multipart

[![npm Version](https://img.shields.io/npm/v/@medley/multipart.svg)](https://www.npmjs.com/package/@medley/multipart)
[![Build Status](https://travis-ci.org/medleyjs/multipart.svg?branch=master)](https://travis-ci.org/medleyjs/multipart)
[![Coverage Status](https://coveralls.io/repos/github/medleyjs/multipart/badge.svg?branch=master)](https://coveralls.io/github/medleyjs/multipart?branch=master)
[![dependencies Status](https://img.shields.io/david/medleyjs/multipart.svg)](https://david-dm.org/medleyjs/multipart)

A Medley plugin for parsing `multipart/form-data` request bodies, which are primarily used for uploading files. It is written on top of [`Busboy`](https://github.com/mscdex/busboy) and inspired by [`multer`](https://github.com/expressjs/multer).


## Installation

```sh
# npm
npm install @medley/multipart

# yarn
yarn add @medley/multipart
```


## Usage

Registering the plugin on an `app` adds a `.multipart()` method to the `app` that can be used to create a `preHandler` hook that will parse `multipart/form-data` bodies.

The hook adds a `body` and a `files` property to the `req` object if it completes successfully, where `req.body` will contain the text values of the form and `req.files` will contain the uploaded files.

If an error occurs, `req.body` and `req.files` will remain `undefined`.

Example:

```html
<form action="/profile" method="post" enctype="multipart/form-data">
  <input type="text" name="firstName" />
  <input type="file" name="profilePhoto" />
</form>
```

```js
const medley = require('@medley/medley');
const app = medley();

app.register(require('@medley/multipart'));

app.post('/profile', [
  app.multipart({
    profilePhoto: {maxCount: 1},
  }),
], (req, res, next) => {
  req.files.profilePhoto // The uploaded file (see File Object below)
  req.body.firstName // The user's first name
});
```


## API

### Plugin Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `preservePath` | `boolean` | If paths in the multipart 'filename' field shall be preserved. | `false` |
| `limits` | `object` | Various limits on incoming data. Valid properties are: |
| `limits.fieldNameSize` | `integer` | Max field name size (in bytes). | `100` |
| `limits.fieldSize` | `integer` | Max field value size (in bytes). | 1 MiB |
| `limits.fields` | `integer` | Max number of non-file fields. | `Infinity` |
| `limits.fileSize` | `integer` | The max file size (in bytes). | `Infinity` |
| `limits.files` | `integer` | The max number of file fields. | `Infinity` |
| `limits.parts` | `integer` | The max number of parts (fields + files). | `Infinity` |
| `limits.headerPairs` | `integer` | The max number of header key-value pairs to parse. | `2000` |

Specifying the limits can help protect your site against denial of service (DoS) attacks.

```js
const medley = require('@medley/medley');
const app = medley();

app.register(require('@medley/multipart'), {
  limits: {
    fieldSize: 100 * 1024, // 100 KiB
    fileSize: 5 * 1024 * 1024, // 5 MiB
    files: 4,
  },
});
```

### `app.multipart(expectedFiles[, options])`

| Option | Type | Description |
|--------|------|-------------|
| `expectedFiles` | `object` or `'ANY_FILES'` | **Required.** An object mapping file field names to the maximum number of files expected for the field. See details below. |
| `options` | `object` | The same as the global [plugin option](#plugin-options). Will be merged with the global plugin options (while taking precedence over them). |

The `options` parameter allows for route-specific control over upload limits.

```js
app.multipart({
  profilePhoto: {maxCount: 1},
}, {
  limits: {
    fields: 1,
    fileSize: 8 * 1024 * 1024, // 8 MiB
  },
})
```

#### `expectedFiles`

Specifies the expected file fields and limits the number of files that can be received for those fields. If unexpected files are received, the upload will be cancelled with an error.

```js
{
  fieldName: { maxCount: integer, optional?: boolean} | integer
}
```

```js
app.multipart({
  someFile: {maxCount: 1},
  multipleFiles: {maxCount: 6},
  moreFiles: 5, // maxCount shorthand
})
```

Expected files are required by default, so an error will be thrown if an expected file is not uploaded. Set `optional: true` to allow the upload to complete without receiving any files for a particular field.

```js
app.post('/upload', [
  app.multipart({
    requiredFile: {maxCount: 1},
    optionalFiles: {maxCount: 5, optional: true},
  }),
], (req, res, next) => {
  req.files.requiredFile // Will always exist
  req.files.optionalFiles // May be `undefined` or an array of files
});
```

The `maxCount` value determines the value type of the property in the `req.files` object. If `maxCount` is `1`, the value will be a [file object](#file-object). If `maxCount > 1`, the value will be an array of file objects (even if only a single file is received).

```js
app.post('/upload', [
  app.multipart({
    oneFile: {maxCount: 1},
    multipleFiles: {maxCount: 5},
  }),
], (req, res, next) => {
  req.files.oneFile // { ... }
  req.files.multipleFiles // [ { ... }, { ... }, { ... } ]
});
```

If `expectedFiles` is the special string `'ANY_FILES'`, any files may be uploaded and file objects will always be stored in an array. Note that it is not advised to use this option in a production environment.

### `multipart.discardFiles(files)`

Exported directly by the module, this method can be used to safely discard all of the files in the `req.files` object.

This is only needed when the multipart `preHandler` hook completes successfully but the files aren't handled after (e.g. if an error happens).

```js
const multipart = require('@medley/multipart');

// ...

// Something went wrong and all of the files need to be discarded
multipart.discardFiles(req.files);
```

### `multipart.MultipartError`

The error constructor that this plugin uses to create errors when something goes wrong. It may sometimes be helpful to check if an error was generated by `multipart` inside an error handler.

```js
const {MultipartError} = require('@medley/multipart');

app.setErrorHandler((err, req, res) => {
  if (err instanceof MultipartError) {
    // This is a multipart error
  }
});
```

See [the code](https://github.com/medleyjs/multipart/blob/master/lib/MultipartError.js) for the properties attached to `MultipartError` objects.

### File Object

| Property | Description |
|----------|-------------|
| `stream` | [`fs.ReadStream`](https://nodejs.org/dist/latest/docs/api/fs.html#fs_class_fs_readstream) of the file. |
| `fileName` | The name of the file on the user's computer. An empty string (`''`) if no name was supplied by the client. |
| `mimeType` | The MIME type of the file reported by the client using the `Content-Type` header. |
| `size` | The size of the file in bytes. |

**Note:** The file `stream` must be handled in some way (even discarded by doing `stream.destroy()`) to ensure that the underlying file descriptor gets closed and the temporary file gets deleted.

```js
app.post('/profile', [
  app.multipart({
    profilePhoto: {maxCount: 1},
  }),
], (req, res, next) => {
  const {profilePhoto} = req.files;

  profilePhoto.stream // ReadStream {}
  profilePhoto.fileName // 'me.jpg'
  profilePhoto.mimeType // 'image/jpeg'
  profilePhoto.size // 3483297
});
```

### Error Handling

When encountering an error, `multipart` will delegate the error to Medley. Note that if `multipart` did not create the error, you may need to discard the uploaded files.

```js
const multipart = require('@medley/multipart');

app.setErrorHandler((err, req, res) => {
  if (err instanceof multipart.MultipartError) {
    // This is a multipart error
  } else if (req.files !== undefined) {
    multipart.discardFiles(req.files);
  }
});
```
