
import startServer from "@prisma-cms/server";

import PrismaUploadModule from "../";

import {ImagesMiddleware} from "../";


const module = new PrismaUploadModule({
});

const resolvers = module.getResolvers();


const imagesMiddleware = new ImagesMiddleware().processRequest;

startServer({
  typeDefs: 'src/schema/generated/api.graphql',
  resolvers,
  imagesMiddleware,
});
