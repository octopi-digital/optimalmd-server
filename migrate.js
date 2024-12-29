const { MongoClient } = require("mongodb");

const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const dbName = process.env.DB_NAME;

const atlasUri = `mongodb+srv://optimalMDStaggingDB:4AlRy9VLZk2uBSHw@cluster0.wvgg4.mongodb.net/${dbName}?retryWrites=true&w=majority&appName=Cluster0`;
const localUri = `mongodb://127.0.0.1:27017/${dbName}?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.3.7`;

const atlasDbName = dbName;  // Atlas database name
const localDbName = dbName;  // Local database name

async function migrateData() {
  try {
    // Connect to the Atlas Database
    const atlasClient = new MongoClient(atlasUri, { useNewUrlParser: true, useUnifiedTopology: true });
    await atlasClient.connect();
    const atlasDb = atlasClient.db(atlasDbName);

    // Connect to the Local Database
    const localClient = new MongoClient(localUri, { useNewUrlParser: true, useUnifiedTopology: true });
    await localClient.connect();
    const localDb = localClient.db(localDbName);

    // Get all collection names from Atlas
    const collections = await atlasDb.listCollections().toArray();
    
    // Migrate each collection
    for (const collection of collections) {
      const atlasCollection = atlasDb.collection(collection.name);
      const localCollection = localDb.collection(collection.name);
      
      // Get all documents from the Atlas collection
      const documents = await atlasCollection.find().toArray();

      // Insert documents into the local collection
      if (documents.length > 0) {
        await localCollection.insertMany(documents);
        console.log(`Migrated collection: ${collection.name}`);
      }
    }

    // Close the connections
    await atlasClient.close();
    await localClient.close();

    console.log("Data migration complete!");
  } catch (err) {
    console.error("Error during migration:", err);
  }
}

migrateData();
