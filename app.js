const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializedbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB error :${error.message}`);
    process.exit(1);
  }
};
initializedbAndServer();
const getfollowingpeopleofids = async (username) => {
  const getthefollowingpeople = `SELECT following_user_id FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id WHERE user.username='${username}';`;
  const followers = await db.all(getthefollowingpeople);
  const peopleids = followers.map((eachuser) => eachuser.following_user_id);
  return peopleids;
};

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken) {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.status("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  } else {
    response.status(401);
    response.status("Invalid JWT Token");
  }
};

const tweetAccessVerification = async (request, response, next) => {
  const { userId } = request;
  const [tweetId] = request.params;
  const gettweetquery = `SELECT * FROM tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id WHERE tweet.tweet_id='${tweetId}'
     AND follower_user_id='${userId}';`;
  const tweet = await db.get(gettweetquery);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  let hashedpassword = await bcrypt.hash(password, 10);
  let checkUserdetails = `SELECT * FROM user WHERE username='${username}';`;
  let register = await db.get(checkUserdetails);
  if (register !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedpassword = await bcrypt.hash(password, 10);
      const createUser = `INSERT INTO user(username,name,gender,password) VALUES('${username}','${hashedPassword}','${name}','${gender}')`;
      const dbUser = await db.run(createUser);
      response.status(200);
      response.send("User created successfully");
    }
  }
});
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const postlogin = `SELECT * FROM user WHERE username='${username}';`;
  const logeduser = await db.get(postlogin);
  if (logeduser !== undefined) {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      logeduser.password
    );
    if (isPasswordCorrect) {
      const payload = { username, userId: logeduser.user_id };
      let jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const followingpeopleids = await getfollowingpeopleofids(username);
    const gettweet = `SELECT username,tweet,date_time AS dateTime FROM user INNER JOIN tweet ON user.user_id=tweet.user_id 
    WHERE user.user_id IN (${followingpeopleids}) ORDER BY tweet.date_time DESC LIMIT 4 ;`;
    const getdbuser = await db.all(gettweet);
    response.send(getdbuser);
  }
);
app.get("/user/following/", authenticationToken, async (request, response) => {
  const { username, userId } = request;
  const followuser = `SELECT name FROM follower INNER JOIN user ON user.user_id=follower.following_user_id WHERE follower_user_id='${userId}';`;
  const result = await db.all(followuser);
  response.send(result);
});
app.get("/user/followers/", authenticationToken, async (request, response) => {
  const { username, userId } = request;
  const followuser = `SELECT DISTINCT name FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id WHERE following_user_id='${userId}';`;
  const result = await db.all(followuser);
  response.send(result);
});
app.get(
  "/tweets/:tweetId/",
  authenticationToken,
  tweetAccessVerification,
  async (request, response) => {
    const { username, userId } = request;
    const { tweetId } = request.params;
    const gettweetquery = `SELECT tweet,(SELECT COUNT() FROM like WHERE tweet_id='${tweetId}') AS Likes, (SELECT COUNT() FROM reply WHERE tweet_id='${tweetId}')AS replies ,date_time AS dateTime 
    FROM tweet WHERE tweet.tweet_id='${tweetId}';`;
    const tweet = await db.get(gettweetquery);
    response.send(tweet);
  }
);
app.get(
  "/tweets/:tweetId/likes/",
  authenticationToken,
  tweetAccessVerification,

  async (request, response) => {
    const { tweetId } = request.params;
    const getlikes = `SELECT username FROM user INNER JOIN like ON user.user_id=like.user_id WHERE tweet_id='${tweetId}';`;
    const likedusers = await db.all(getlikes);
    const liked = likedusers.map((eachuser) => eachuser.username);
    respond.send({ likes: liked });
  }
);
app.get(
  "/tweets/:tweetId/replies/",
  authenticationToken,
  tweetAccessVerification,
  async (request, response) => {
    const { tweetId } = request.params;
    const gettweet = `SELECT name,reply FROM user INNER JOIN reply ON user.user_id=reply.user_id WHERE tweet_id='${tweetId}';`;
    const listofreplies = await db.all(gettweet);
    respond.send({ replies: listofreplies });
  }
);
app.get("/user/tweets/", authenticationToken, async (request, response) => {
  const { userId } = request;
  const gettweetquery = `SELECT tweet, COUNT(DISTINCT like_id) AS likes,COUNT(DISTINCT reply_id) AS replies,date_time AS dateTime FROM tweet LEFT JOIN reply ON tweet.tweet_id=reply.tweet_id
   LEFT JOIN like ON tweet.tweet_id=like.tweet_id WHERE tweet.user_id='${userId}' GROUP BY tweet.tweet_id;`;
  const tweetquery = await db.all(gettweetquery);
  response.send(tweetquery);
});
app.post("/user/tweets/", authenticationToken, async (request, response) => {
  const { tweet } = request.body;
  const userId = parseInt(request.userId);
  const dateTime = new Date().toJSON().substring(0, 19).replace("T", " ");
  const createtweetquery = `INSERT INTO tweet(tweet,user_id,date_time) VALUES('${tweet}','${userId}','${dateTime}')`;
  await db.run(createtweetquery);
  response.send("Created a Tweet");
});
app.delete(
  "/tweets/:tweetId/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { userId } = request;
    const getthetweetquery = `SELECT * FROM tweet WHERE tweet_id='${tweetId}' AND user_id='${userId}';`;
    const tweet = await db.get(getthetweetquery);
    if (tweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deletetweetquery = `DELETE FROM tweet WHERE tweet_id='${tweetId}';`;
      await db.run(deletetweetquery);
      response.send("Tweet Removed");
    }
  }
);
module.exports = app;
