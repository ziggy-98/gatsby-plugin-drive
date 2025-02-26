const { GoogleToken } = require('gtoken');
const request = require('request');

const getToken = ({ keyFile, key }) => {
  return new Promise((resolve, reject) => {
    const scope = ['https://www.googleapis.com/auth/drive']
    const gtoken = keyFile ?
      new GoogleToken({
        keyFile,
        scope: scope
      }) :
      new GoogleToken({
        email: key.client_email,
        scope: scope,
        key: key.private_key.replace(/(\\r)|(\\n)/g, '\n')
      });

    gtoken.getToken((err, token) => {
      if (err) {
        reject(err);
      } else {
        resolve(token);
      }
    });
  });
};

const getFolder = (folderId, token) => {
  // console.log('hello');
  return new Promise((resolve, reject) => {
    request(
      {
        uri: `https://www.googleapis.com/drive/v3/files`,
        auth: {
          bearer: token,
        },
        qs: {
          q: `'${folderId}' in parents`,
          fields: `files(id, kind, name, parents, webViewLink, mimeType)`
        },
      },
      (err, res, body) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          resolve(JSON.parse(body).files);
        }
      }
    );
  });
};

const getFile = (fileId, token) => {
  // console.log('hello2');
  return new Promise((resolve, reject) => {
    requestFile(resolve, reject, fileId, token, 1100);
  });
};

const getGDoc = (fileId, token, mimeType) => {
  return new Promise((resolve, reject) => {
    request({
      uri: `https://www.googleapis.com/drive/v3/files/${fileId}/export`,
      auth: {
        bearer: token
      },
      encoding: null,
      qs: {
        mimeType: mimeType
      }
    }, (err, res, body) => {
      if (err) {
        reject(err)
      } else {
        resolve(body)
      }
    })
  })
}

module.exports = {
  getToken,
  getFolder,
  getFile,
  getGDoc
};

function requestFile(resolve, reject, fileId, token, delay) {
  request(
  {
    uri: `https://www.googleapis.com/drive/v3/files/${fileId}`,
    auth: {
      bearer: token,
    },
    qs: {
      fields: `id, kind, name, parents, webViewLink, mimeType`
    },
  },
  (err, res, body) => {
    if (err) {
      reject(err);
    } else if (res.statusCode == 403) {
      console.log('hello3');
      setTimeout(() => {
        requestFile(resolve, reject, fileId, token, delay * 2);
      }, delay * 2);
    } else {
      resolve(body);
    }
  });
};
