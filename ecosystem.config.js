module.exports = {
  apps: [{
    name: "cityscope-backend",
    script: "index.js",
    instances: "max",
    exec_mode: "cluster",
    watch: false,
    env: {
      PORT: 3000,
      JWT_SECRET: process.env.JWT_SECRET,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_ACCESS_SECRET_KEY: process.env.AWS_ACCESS_SECRET_KEY,
      AWS_ACCESS_REGION: process.env.AWS_ACCESS_REGION,
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
      S3_USER_BUCKET_NAME: process.env.S3_USER_BUCKET_NAME,
      MONGO_URI: process.env.MONGO_URI
    },
  }]
};
