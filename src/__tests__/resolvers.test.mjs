
import expect from "expect";

import TestModule from "./default/module";

const module = new TestModule();

const resolvers = module.getResolvers();

const {
  Query: {
    files,
  },
  Mutation: {
    singleUpload,
    multipleUpload,
  },
} = resolvers;

// console.log("resolvers", resolvers);

describe("Resolvers", () => {

  it("Query", () => {

    expect(typeof files === "function").toBe(true);

  })

  it("Mutation", () => {

    expect(typeof singleUpload === "function").toBe(true);
    expect(typeof multipleUpload === "function").toBe(true);

  })

});

