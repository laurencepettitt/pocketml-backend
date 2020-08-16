const admin = require("firebase-admin");
const functions = require("firebase-functions");
const express = require("express");

admin.initializeApp();
const db = admin.database();

const { ApolloServer, gql } = require("apollo-server-express");

// Construct a schema, using GraphQL schema language
const typeDefs = gql`
type DImage {
  dClass: ID!
  id: ID!
  version: Int!
  url: String!
}

type Query {
  dImage(id: ID!): DImage
  dImages: [DImage!]!
  dClasses: [ID!]!
}

type Mutation {
  setDImage(
    id: ID!
    dClass: ID!
    url: String!
    version: Int!
  ): Boolean

  updateDImage(
    id: ID!
    dClass: ID
    url: String
    version: Int
  ): Boolean

  deleteDImage(
    id: ID!
  ): Boolean
}`;


function cleanObj(obj) {
  for (var propName in obj) { 
    if (obj[propName] === null || obj[propName] === undefined) {
      delete obj[propName];
    }
  }
}

function getDImageResolver(id) {
  return db
    .ref(`dImages/${id}`)
    .once("value")
    .then(snap => snap.val());
}



function getDImagesResolver() {
  return db
    .ref("dImages")
    .once("value")
    .then(snap => snap.val())
    .then(val => Object.keys(val).map(key => val[key]))
}

function getDClassesResolver() {
  return db
    .ref("dClasses")
    .once("value")
    .then(snap => snap.val())
    .then(val => Object.keys(val).map(key => val[key]))
}

function setDImageResolver(dClass, id, version, url) {
  setDClassResolver(dClass)
  return db
    .ref(`dImages/${id}`)
    .set({
      dClass: dClass,
      id: id,
      version: version,
      url: url
    })
    .then(() => true)
    .catch(function setExampleDatabaseUpdateRejected() {
      console.log("Synchronisation with Firebase DB failed.");
      return false;
    });
}

function deleteDImageResolver(id) {
  return db
    .ref(`dImages/${id}`)
    .set(null)
    .then(() => true)
    .catch(function setExampleDatabaseUpdateRejected() {
      console.log("Synchronisation with Firebase DB failed.");
      return false;
    });
}

function setDClassResolver(dClass) {
  if (dClass === null || dClass === undefined) {
    return Promise.resolve(true)
  }
  return db
    .ref(`dClasses/${dClass}`)
    .set(dClass)
    .then(() => true)
    .catch(function setExampleDatabaseUpdateRejected() {
      console.log("Synchronisation with Firebase DB failed.");
      return false;
    });
}

function updateDImageResolver(dClass, id, version, url) {
  var dClassResultPromise = setDClassResolver(dClass);
  var obj = {
    dClass: dClass,
    id: id,
    version: version,
    url: url
  };
  cleanObj(obj);
  var dImageResultPromise = db
    .ref(`dImages/${id}`)
    .update(obj)
    .then(() => true)
    .catch(function setExampleDatabaseUpdateRejected() {
      console.log("Synchronisation with Firebase DB failed.");
      return false;
    });

  return Promise
    .all([dClassResultPromise, dImageResultPromise])
    .then(resultsArray => resultsArray.every(res => res))
}

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    dImage: (parent, { id }) => getDImageResolver(id),
    dImages: getDImagesResolver,
    dClasses: getDClassesResolver
  },

  Mutation: {
    setDImage: (parent, { dClass, id, version, url }) => setDImageResolver(dClass, id, version, url),
    updateDImage: (parent, { dClass, id, version, url }) => updateDImageResolver(dClass, id, version, url),
    deleteDImage: (parent, { id}) => deleteDImageResolver(id)
  },
};

// setup express cloud function
const app = express();
const server = new ApolloServer({ typeDefs, resolvers });
server.applyMiddleware({ app, path: "/", cors: true });

exports.graphql = functions.https.onRequest(app);
