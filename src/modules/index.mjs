
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

    const {
      file: upload,
    } = args;

    return await this.processUpload(upload, ctx, info);

  }


  async multipleUpload(parent, args, ctx, info) {

    const {
      files,
    } = args;


    let { resolve, reject } = await this.uploadAll(files.map(upload => {
      return this.processUpload(upload, ctx, info);
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


  storeFS({ stream, filename }) {

    const {
      uploadDir,
    } = this;

    // Ensure upload directory exists
    mkdirp.sync(uploadDir)

    const id = shortid.generate()

    const path = `${uploadDir}/${id}-${filename}`

    return new Promise((resolve, reject) =>
      stream
        .on('error', error => {
          if (stream.truncated)
            // Delete the truncated file
            unlinkSync(path)
          reject(error)
        })
        .on('end', () => resolve({ id, path }))
        .pipe(createWriteStream(path))
    )
  }


  async processUpload(upload, ctx, info) {


    let file = {};

    this.assignUser(file, ctx);

    const { stream, filename, mimetype, encoding } = await upload;

    const writeResult = await this.storeFS({ stream, filename })

    const { path } = writeResult;


    if (path) {

      Object.assign(file, {
        filename,
        mimetype,
        encoding,
        path: path.replace(/^\.\//, ''),
      });

      return await ctx.db.mutation.createFile({
        data: file,
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