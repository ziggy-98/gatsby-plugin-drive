const googleapi = require(`./googleapis`);
const mkdirp = require(`mkdirp`);
const fs = require('fs');

const FOLDER = `application/vnd.google-apps.folder`;
const GOOGLE_DOC = 'application/vnd.google-apps.document';

let shouldExportGDocs;
let exportMime;
let middleware;

exports.sourceNodes = async (
  { actions, createNodeId, createContentDigest },
  { folderId, keyFile, key, exportGDocs, exportMimeType, exportMiddleware }
) => {
  const { createNode } = actions;
  return new Promise(async resolve => {
    // log(`Started downloading content`);

    // Get token and fetch root folder.
    const token = keyFile ? 
      await googleapi.getToken({ keyFile }) :
      await googleapi.getToken({ key });
    const cmsFiles = await googleapi.getFolder(folderId, token);
    shouldExportGDocs = exportGDocs;
    exportMime = exportMimeType;
    middleware = exportMiddleware === undefined 
      ? x => x 
      : exportMiddleware; 

    // Create content directory if it doesn't exist.
    // mkdirp(destination);

    // Start downloading recursively through all folders.
    // console.time(`Downloading content`);
    getDirectory({}, cmsFiles, token).then((json) => {
      // console.timeEnd(`Downloading content`);
      // fs.writeFile('google-drive-data.json', JSON.stringify(json), err => {
      //   if (err) return log(err);
      // });
      if(Array.isArray(json)){
        json = json[0];
      }
      console.log('folder mapping finished');
      let nodes = mapNodes(json);
      // fs.writeFile('google-drive-data.json', JSON.stringify(nodes), err => {
      //   if (err) return log(err);
      // });
      nodes = nodes.reverse();
      nodes.map((node, index) => {
        createNode({
          ...node,
          id: `google-drive-node-${node.id}`,
          internal: {
            type: 'GoogleDriveNode',
            contentDigest: createContentDigest(node)
          }
        });
      });
      resolve();
    });
  });
};

function mapNodes(data, parent = ''){
  let nodes = [];
  keys = Object.keys(data);
  keys.forEach( key => {
    let children;
    if(data[key].children){
      children = { ...data[key].children };
    }
    delete data[key].children;
    let mappedNode = {
      ...data[key],
    };
    if(children && Object.keys(children).length > 0){
      let childrenProp = [];
      let childrenNames = Object.keys(children);
      childrenNames.forEach(child => {
        childrenProp.push(`google-drive-node-${children[child].id}`);
      });
      mappedNode.folderChildren___NODE = childrenProp;
    }else{
      mappedNode.subs = [];
    }
    mappedNode.url = `/downloads/${parent}${key}`
    mappedNode.isTopLevel = (!parent ? true : false);
    nodes.push(mappedNode);
    if(children){
      if(Object.keys(children).length > 0){
        let urlParent = parent+key+'/';
        nodes = nodes.concat(mapNodes(children, urlParent));
      }
    }
  })
  return nodes;
}

function getDirectory(json = {}, array, token){
  let filesToDownload = shouldExportGDocs ? array : array.filter(file => file.mimeType !== GOOGLE_DOC);
  let promise = new Promise(async (resolve, reject) => {
    let promises = [];
    filesToDownload.forEach(async (file, index) => {
        file.name = file.name.replace(/ /g, '_');
        if(file.mimeType === FOLDER){
          promises.push(new Promise(async (resolve, reject) => {
            let folderFields = await googleapi.getFile(file.id, token);
            folderFields = JSON.parse(folderFields);
            // console.log('hello3');
            // console.log(folderFields);
            const files = await googleapi.getFolder(file.id, token);
            if(files){
              getDirectory({}, files, token).then(res => {
                json[file.name] = {
                  ...folderFields,
                  children: res};
                resolve(json);
              });
            }else{
              json[file.name] = {...folderFields};
              resolve(json);
            }
          }));
        }else{
          promises.push(new Promise(async (resolve, reject) => {
            const fileName = getFilenameByMime(file).replace(/ /g, '_');
            json[fileName] = file;
            resolve(json);
          }));
        }
    });
    if(promises.length > 1){
      Promise.all(promises).then(jsonObjects => {
        if(jsonObjects.length > 1){
          jsonObjects = jsonObjects[0];
        }
        resolve(jsonObjects);
      });
    }else if(promises.length === 1){
      promises[0].then(jsonObject => {
        resolve(jsonObject);
      });
    }else{
      resolve({});
    }
  });

  return promise;
}

const fileExtensionsByMime = new Map([
  ['text/html', '.html'],
  ['application/zip', '.zip'],
  ['text/plain', '.txt'],
  ['application/rtf', '.rtf'],
  ['application/vnd.oasis.opendocument.text', '.odt'],
  ['application/pdf', '.pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/epub+zip', '.epub']
]);

const getFilenameByMime = file => {
  if (file.mimeType === GOOGLE_DOC) {
    return `${file.name}${fileExtensionsByMime.get(exportMime)}`
  } else {
    return file.name;
  }
}

function addFolder(obj, path, fileName){
  // console.log(obj);
  // console.log(path);
  if(path){
    for (var i=0, path=path.split('.'), len=path.length; i<len; i++){
      if(i+1 == len){
        obj[path[i]][fileName] = {};
      }
    };
  }else{
    obj[fileName] = {};
  }
  return obj;
}

function addFile(obj, path, file){
  let newObj = {...obj};
  for (var i=0, path=path.split('.'), len=path.length; i<len; i++){
    if(i+1 == len){
      // console.log(path[i]);
      newObj[path[i]][file.name] = file;
    }else{
      newObj = newObj[path[i]];
    }
  };

  // console.log(newObj);
  // console.log(obj);

  return newObj;
}
