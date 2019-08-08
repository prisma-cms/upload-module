
import fs from "fs";

import chalk from "chalk";

import PrismaModule from "@prisma-cms/prisma-module";

import MergeSchema from 'merge-graphql-schemas';

import mkdirp from "mkdirp";
import shortid from "shortid";

import path from 'path';

const moduleURL = new URL(import.meta.url);

const __dirname = path.dirname(moduleURL.pathname);

const { createWriteStream, unlinkSync } = fs;

const { fileLoader, mergeTypes } = MergeSchema



class PrismaUploadModule extends PrismaModule {



  constructor(props = {}) {

    const {
      uploadDir = "uploads",
    } = props;

    super(props);

    const {
      authRequired = false,
    } = props;


    Object.assign(this, {
      uploadDir,
      authRequired,

      Query: {
        file: (parent, args, ctx, info) => this.file(parent, args, ctx, info),
        files: (parent, args, ctx, info) => this.files(parent, args, ctx, info),
        filesConnection: (parent, args, ctx, info) => this.filesConnection(parent, args, ctx, info),
      },

      Mutation: {
        singleUpload: this.singleUpload.bind(this),
        multipleUpload: this.multipleUpload.bind(this),
      },
    });

  }


  getSchema(types = []) {


    let schema = fileLoader(__dirname + '/schema/database/', {
      recursive: true,
    });


    if (schema) {
      types = types.concat(schema);
    }


    let typesArray = super.getSchema(types);

    return typesArray;

  }


  getApiSchema(types = []) {


    let baseSchema = [];

    let schemaFile = __dirname + "/../schema/generated/prisma.graphql";

    if (fs.existsSync(schemaFile)) {
      baseSchema = fs.readFileSync(schemaFile, "utf-8");
    }

    let apiSchema = super.getApiSchema(types.concat(baseSchema), []);

    let schema = fileLoader(__dirname + '/schema/api/', {
      recursive: true,
    });

    apiSchema = mergeTypes([apiSchema.concat(schema)], { all: true });


    return apiSchema;

  }


  getResolvers() {


    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, this.Query);


    Object.assign(resolvers.Mutation, this.Mutation);


    Object.assign(resolvers, {
    });


    return resolvers;
  }



  file(source, args, ctx, info) {

    return ctx.db.query.file({}, info);

  }


  files(source, args, ctx, info) {

    return ctx.db.query.files({}, info);

  }


  filesConnection(source, args, ctx, info) {

    return ctx.db.query.filesConnection({}, info);

  }


  async singleUpload(parent, args, ctx, info) {

    // const {
    //   file: upload,
    // } = args;

    return await this.processUpload(parent, args, ctx, info);

  }


  async multipleUpload(parent, args, ctx, info) {

    const {
      files,
    } = args;


    let { resolve, reject } = await this.uploadAll(files.map(upload => {
      return this.processUpload(parent, {
        data: {
          file: upload,
        },
      }, ctx, info);
    }));

    if (reject.length) {
      reject.forEach(({ name, message }) =>
        // eslint-disable-next-line no-console
        console.error(`${name}: ${message}`)
      )
    }


    resolve = (resolve && resolve
      .filter(n => n)
    ) || null;


    return resolve;
  }


  async storeFS({
    stream,
    filename,
    directory,
  }) {

    const {
      uploadDir: baseDir,
    } = this;

    const baseDirAbsolute = path.resolve(baseDir);

    // console.log("baseDirAbsolute", baseDirAbsolute);

    let uploadDir = path.join(baseDir, directory || "");

    // console.log("uploadDir", uploadDir);

    mkdirp.sync(uploadDir);

    // await mkdirp(uploadDir);

    const id = shortid.generate()

    // const file = `${uploadDir}/${id}-${filename}`;

    const file = path.join(uploadDir, `${id}-${filename}`);


    // console.log("baseDir", baseDir);

    // console.log("file path", file);

    let resolved = path.resolve(file);

    const normalized = path.normalize(resolved);

    // console.log("file path.resolve()", resolved);
    // console.log("file normalized", normalized);

    // console.log("file .relative()", path.relative(baseDir, normalized));

    if (!normalized.startsWith(baseDirAbsolute)) {
      throw new Error("Wrong directory");
    }


    // return;

    return new Promise((resolve, reject) => {

      try {

        const pipe = createWriteStream(file);

        pipe.on('error', function (err) {
          console.error(err);
          reject(err);
        });

        stream
          .on('error', error => {

            if (stream.truncated) {
              // Delete the truncated file
              try {
                unlinkSync(file)
              }
              catch (error) {

                console.error(error);

                reject();

              }
            }

            reject(error)
          })
          .on('end', () => resolve({
            id,
            path: file,
          }))
          .pipe(pipe)
      }
      catch (error) {
        console.error(error);
      }

    })
  }


  async processUpload(parent, args, ctx, info) {

    // console.log("processUpload args", JSON.stringify(args, true, 2));


    let {
      file: upload,
      data,
    } = args;

    let {
      file,
      directory,
      ...other
    } = data || {};

    upload = file ? file : upload;



    // return await this.storeFS({
    //   // stream,
    //   filename: "ssds/test.jpg",
    //   directory,
    // });



    if (!upload) {
      throw new Error("Can not get file");
    }


    let uploaded = {};

    this.assignUser(uploaded, ctx);

    const {
      stream,
      filename,
      mimetype,
      encoding,
    } = await upload;


    const writeResult = await this.storeFS({
      stream,
      filename,
      directory,
    })
    // .
    //   catch(error => {

    //     console.error("error", error);

    //   })


    const { path } = writeResult;


    
    if (path) {
      
      const stats = fs.statSync(path);

      const {
        size,
      } = stats;

      Object.assign(uploaded, {
        ...other,
        filename,
        mimetype,
        encoding,
        path: path.replace(/^\.\//, ''),
        size,
      });

      return await ctx.db.mutation.createFile({
        data: uploaded,
      }, info)
        .catch(error => {
          throw error;
        });
    }
    else {
      throw new Error(`Can not upload file ${filename}`);
    }

  }


  assignUser(file, ctx) {

    const {
      currentUser,
    } = ctx;

    const {
      id: userId,
    } = currentUser || {};

    if (this.authRequired && !userId) {
      throw new Error("Authorization required")
    }

    if (userId) {

      Object.assign(file, {
        CreatedBy: {
          connect: {
            id: userId,
          }
        }
      });
    }

    return file;

  }


  uploadAll(tasks) {

    return new Promise(async (resolve, reject) => {

      let result = {
        resolve: [],
        reject: [],
      }

      let processor = this.processUploadGenerator(tasks);

      for await (const n of processor) {

        if (n && n instanceof Error) {
          result.reject.push(n);
        }
        else {
          result.resolve.push(n);
        }

      }

      resolve(result);

    });

  }

  async * processUploadGenerator(tasks) {

    while (tasks && tasks.length) {

      const task = tasks.splice(0, 1)[0];

      const result = await task
        .catch(error => {
          return error;
        });

      yield result;

    }

  }

}


export default PrismaUploadModule;