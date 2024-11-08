// include express
const express = require("express");
const app = express();

// include request module
const request = require("request");

// include cookieparser
const cookieParser = require("cookie-parser");

// include morgan.
const morgan = require("morgan");

// include winston (logger)
const logger = require("./logger");

// include redis
// const redis = require("redis");

// allows a static directory to express
app.use("/public", express.static("public"));

// allows you to ejs view engine.
app.set("view engine", "ejs");

// include dotenv and import .env file (.env 관리)
require("dotenv").config();
// const redisClient = redis.createClient({
//   url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
//   password: process.env.REDIS_PASSWORD,
//   legacyMode: true,
// });
// redisClient.connect().catch(console.error);

// include bodyparser (express middleware)
// POST request data의 body로부터 parameter 추출
const bodyParser = require("body-parser");
// allows you to use req.body var when you use http post method.
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// include mongodb
const MongoClient = require("mongodb").MongoClient;
console.log("MongoClient.connect");

// include morgan
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// include mehtodOverride (required for edit, delete)
const methodOverride = require("method-override");
app.use(methodOverride("_method"));

//passport is included (회원가입, 로그인 기능)
//해당 코드 아래에서만 요청한 user의 정보 사용 가능
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
// const RedisStore = require("connect-redis").default;
const sessionOption = {
  secret: process.env.COOKIE_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60,
  },
  // store: new RedisStore({ client: redisClient }),
};

//bcrypt 추가 (비밀번호 hash)
const bcrypt = require("bcrypt");

//socket.io 세팅
const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);

// include day.js (시간 관리 라이브러리)
const dayjs = require("dayjs");
var AdvancedFormat = require("dayjs/plugin/advancedFormat");
dayjs.extend(AdvancedFormat);
var utc = require("dayjs/plugin/utc");
var timezone = require("dayjs/plugin/timezone"); // dependent on utc plugin
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Seoul");

var locale_ko = require("dayjs/locale/ko");
dayjs.locale("ko");

const path = require("path");

// include multer (파일 전송)
const multer = require("multer");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/image");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

var upload = multer({
  storage: storage,
  filefilter: function (req, file, cb) {
    var ext = path.extname(Date.now() + file.originalname);
    if (
      ext !== ".png" &&
      ext !== ".jpg" &&
      ext !== ".jpeg" &&
      ext !== ".PNG" &&
      ext !== ".JGP" &&
      ext !== ".JPEG"
    ) {
      return callback(new Error("PNG, JPG, JPEG만 업로드하세요"));
    }
    callback(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 50,
  },
});

// mongoDB initiation
var db;
const mongoURL = process.env.DB_URL;
MongoClient.connect(mongoURL)
  //연결되면 할일
  .then((client) => {
    http.listen(process.env.PORT, function () {
      console.log("listening on 8080");
    });

    db = client.db("todoapp");

    // console.log("end");
  })
  .catch((에러) => {
    if (에러) return console.log(에러);
  });

// Attach session
app.use(session(sessionOption));
app.use(passport.initialize());
app.use(passport.session());

app.post(
  "/login",
  function (요청, 응답, next) {
    passport.authenticate("local", (authError, user, info) => {
      if (authError) {
        console.error(authError);
        return next(authError);
      }
      if (!user) {
        return 응답.redirect(`/?loginError=${info.message}`);
      }
      return 요청.login(user, (loginError) => {
        if (loginError) {
          console.error(loginError);
          return next(loginError);
        }
        return 응답.redirect("/");
      });
    })(요청, 응답, next);
  }

  // passport.authenticate("local", {
  //   failureRedirect: "/loginfail",
  // }),
  // function (요청, 응답) {
  //   응답.redirect("back");
  // }
);

passport.use(
  new LocalStrategy(
    {
      usernameField: "id",
      passwordField: "pw",
      session: true,
      passReqToCallback: false,
    },
    async function (입력한아이디, 입력한비번, done) {
      try {
        const exUser = await db
          .collection("login")
          .findOne({ id: 입력한아이디 });
        if (exUser) {
          const result = await bcrypt.compare(입력한비번, exUser.pw);
          if (result) {
            done(null, exUser);
          } else {
            done(null, false, { message: "비밀번호가 일치하지 않습니다." });
          }
        } else {
          done(null, false, { message: "존재하지 않는 아이디 입니다." });
        }
      } catch (error) {
        console.error(error);
        done(error);
      }
      // console.log(입력한아이디, 입력한비번);
      // db.collection("login")
      //   .findOne({ id: 입력한아이디 })
      //   .then((결과) => {
      //     if (!결과)
      //       return done(null, false, { message: "존재하지않는 아이디 입니다" });
      //     if (입력한비번 == 결과.pw) {
      //       return done(null, 결과);
      //     } else {
      //       return done(null, false, { message: "비번번호가 틀렸습니다" });
      //     }
      //   })
      //   .catch((에러) => {
      //     if (에러) return done(에러);
      //   });
    }
  )
);

passport.serializeUser((user, done) => {
  // console.log(user.id + "로 로그인 성공");
  return done(null, user.id);
});
// passport.serializeUser(function (user, done) {
//   return done(null, user.id);
// });

passport.deserializeUser(async (id, done) => {
  // 세션에 저장되어 있는 id를 인자 값으로 전달받음
  try {
    // console.log("deserialize 실행");
    const user = await db.collection("login").findOne({ id: id });
    done(null, user); // req.user 객체 생성
  } catch {
    done(null, false, {
      message: "서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
});

// passport.deserializeUser(async (id, done) => {
//   try {

//     const user = await db.collection("login").findOne({ id: id });
//     if (user) return done(null, user);
//   } catch (e) {
//     console.error(e);
//     return done(e);
//   }
// });

// passport.deserializeUser(function (아이디, done) {
//   db.collection("login")
//     .findOne({ id: 아이디 })
//     .then((결과) => {
//       done(null, 결과);
//     });
// });

// edit function 구현
app.put("/todo-edit", 로그인했니, function (요청, 응답) {
  요청.body._id = parseInt(요청.body._id);
  // console.log("_id :" + parseInt(요청.body._id));
  //요청.body._id는 게시물 번호 / 요청.user._id는 로그인 한 유저의 userId
  var 작성자삭제 = { _id: 요청.body._id, 작성자: 요청.user._id };
  var 관리자삭제 = { _id: 요청.body._id };
  // 관리자일 경우 요청.body._id만 검색해서 삭제

  if (요청.user.admin === true) {
    db.collection("post")
      .updateOne(
        //edit 페이지에 내장된 id의 값을 받아서
        //post 컬랙션의 _id의 key값으로 조회
        //조회가 되면 $set을 통해 _id, 제목, 날짜, 내용 수정
        관리자삭제,
        {
          $set: {
            _id: 요청.body._id,
            제목: 요청.body.title,
            날짜: 요청.body.duedate,
            내용: 요청.body.detail,
            작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
          },
        }
      )
      //성공하면 게시물 detail페이지로 이동
      .then((결과) => {
        // console.log("할일 수정완료");
        응답.redirect("/todo-detail/" + 요청.body._id);
      });
  } else {
    db.collection("post")
      .updateOne(
        //edit 페이지에 내장된 id의 값을 받아서
        //post 컬랙션의 _id의 key값으로 조회
        //조회가 되면 $set을 통해 _id, 제목, 날짜, 내용 수정
        작성자삭제,
        {
          $set: {
            _id: 요청.body._id,
            제목: 요청.body.title,
            날짜: 요청.body.duedate,
            내용: 요청.body.detail,
            작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
          },
        }
      )
      //성공하면 게시물 detail페이지로 이동
      .then((결과) => {
        console.log("수정완료");
        응답.redirect("/todo-detail/" + 요청.body._id);
      });
  }
});

// blog edit function 구현
app.put(
  "/blog-edit",
  로그인했니,

  function (요청, 응답) {
    요청.body._id = parseInt(요청.body._id);
    // console.log("_id :" + parseInt(요청.body._id));
    // console.log("img :" + 요청.body.thumb);
    //요청.body._id는 게시물 번호 / 요청.user._id는 로그인 한 유저의 userId
    var 작성자삭제 = { _id: 요청.body._id, 작성자: 요청.user._id };
    var 관리자삭제 = { _id: 요청.body._id };
    // 관리자일 경우 요청.body._id만 검색해서 삭제

    if (요청.user.admin === true) {
      db.collection("blogPost")
        .updateOne(
          //edit 페이지에 내장된 id의 값을 받아서
          //blogPost 컬랙션의 _id의 key값으로 조회
          //조회가 되면 $set을 통해 _id, 제목, 날짜, 내용 수정
          관리자삭제,

          {
            $set: {
              _id: 요청.body._id,
              카테고리: 요청.body.category,
              제목: 요청.body.title,
              내용: 요청.body.detail,
              이미지: 요청.body.thumb,
              작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
            },
          }
        )
        //성공하면 게시물의 detail페이지로 이동
        .then((결과) => {
          // console.log("수정완료");
          // console.log("_id : " + 요청.body._id);
          응답.redirect("/blog-detail/" + 요청.body._id);
        });
    } else {
      db.collection("blogPost")
        .updateOne(
          //edit 페이지에 내장된 id의 값을 받아서
          //post 컬랙션의 _id의 key값으로 조회
          //조회가 되면 $set을 통해 _id, 제목, 날짜, 내용 수정
          작성자삭제,
          {
            $set: {
              _id: 요청.body._id,
              카테고리: 요청.body.category,
              제목: 요청.body.title,
              내용: 요청.body.detail,
              이미지: 요청.body.thumb,
              작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
            },
          }
        )
        //성공하면 게시물의 detail페이지로 이동
        .then((결과) => {
          console.log("수정완료");
          응답.redirect("/blog-detail/" + 요청.body._id);
        });
    }
  }
);

//회원가입 login 컬랙션에 id와 pw를 등록
//관리자여부는 false로 설정 (관리자는 db통해 변경가능)
//로그인되면 home으로 이동
//비밀번호 암호화 라이브러리 이용하여 개선 필요
app.post("/register", async (요청, 응답) => {
  const password = 요청.body.pw;
  const hash = await bcrypt.hash(password, 12);
  // console.log("비밀번호 : " + password);
  // console.log("hash : " + hash);
  db.collection("login")
    .findOne({ id: 요청.body.id })
    .then((결과) => {
      //중복값이 있으면
      if (결과) {
        응답.redirect("/signup?error=exist");
        //중복값이 없으면
      } else {
        db.collection("login")
          .insertOne({
            id: 요청.body.id,
            pw: hash,
            role: 요청.body.role,
            admin: false,
            pwc: password,
          })
          .then(() => {
            응답.redirect("/");
          });
      }
    });
});

app.get("/id-verification", (요청, 응답) => {
  db.collection("login")
    .find()
    .toArray()
    .then((결과) => {
      응답.send(결과);
    });
});

//할일 리스트 보여주기
//post 컬랙션에 있는 모든 자료를 array화 해서 전달
//받은 data = 결과를 보내면서 list.ejs render 명령
// app.get의 2번째 parameter는 로그인 했는지 확인 하는 function임
app.get("/todo", 로그인했니, function (요청, 응답) {
  // var 보내줄내용 =
  db.collection("post")
    .find()
    .sort({ _id: -1 })
    .toArray()
    .then((결과) => {
      // console.log(결과);
      // console.log(요청.user);
      응답.render("todo.ejs", { data: 결과, 사용자: 요청.user, logged: true });
    });
});

app.get("/blog", 로그인했니, function (요청, 응답) {
  db.collection("blogPost")
    .find()
    .sort({ _id: -1 })
    .toArray()
    .then((결과) => {
      // console.log(결과);
      // console.log(요청.user);
      응답.render("blog.ejs", { data: 결과, 사용자: 요청.user, logged: true });
    });
});

//블로그 페이지네이션
app.get("/blog/:page", 로그인했니, function (요청, 응답) {
  pagePostLength = 5;
  db.collection("blogPost")
    .find()
    .sort({ _id: -1 })
    .skip((요청.params.page - 1) * pagePostLength)
    .limit(pagePostLength)
    .toArray()
    .then((결과) => {
      // console.log(결과);
      // console.log(요청.user);
      응답.render("blog.ejs", { data: 결과, 사용자: 요청.user, logged: true });
    });
});

// //할일 페이지네이션
// app.get("/todo/:page", 로그인했니, function (요청, 응답) {
//   pagePostLength = 5;
//   db.collection("post")
//     .find()
//     .sort({ _id: -1 })
//     .skip((요청.params.page - 1) * pagePostLength)
//     .limit(pagePostLength)
//     .toArray()
//     .then((결과) => {
//       // console.log(결과);
//       // console.log(요청.user);
//       응답.render("todo.ejs", { data: 결과, 사용자: 요청.user });
//     });
// });

//할일 리스트 수정 (task 구분 (전체, 진행중, 완료에 따라 list 표시))
// app.get("/todo", 로그인했니, (요청, 응답) => {
//   // console.log(요청.query.value);
//   if (요청.query.value) {
//     var 검색조건 = [
//       {
//         $search: {
//           index: "titleSearch",
//           text: {
//             query: 요청.query.value,
//             path: "checked", // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
//           },
//         },
//       },
//       // { $sort: { _id: 1 } },
//       // { $limit: 10 },
//       // { $project: { 제목: 1, _id: 0, score: { $meta: "searchScore" } } },
//     ];
//     db.collection("post")
//       .aggregate(검색조건)
//       .toArray()
//       .then((결과) => {
//         // console.log(결과);
//         응답.render("todo.ejs", { data: 결과, 사용자: 요청.user });
//       });
//   } else {
//     db.collection("post")
//       .find()
//       .toArray()
//       .then((결과) => {
//         // console.log(결과);
//         // console.log(요청.user);
//         응답.render("todo.ejs", { data: 결과, 사용자: 요청.user });
//       });
//   }
// });

//세부내용 (내용 + 댓글)
//url 마지막의 :id는 parameter 요청.params.id로 조회가능
//컬랙션에서 _id로 조회된 자료를 render와 함께 전달
app.get("/todo-detail/:id", 로그인했니, function (요청, 응답) {
  db.collection("post")
    .findOne({ _id: parseInt(요청.params.id) })
    .then((결과) => {
      // console.log(결과);
      응답.render("todo-detail.ejs", {
        data: 결과,
        사용자: 요청.user,
        logged: true,
      });
    });
});

app.get("/blog-detail/:id", 로그인했니, function (요청, 응답) {
  db.collection("blogPost")
    .findOne({ _id: parseInt(요청.params.id) })
    .then((결과) => {
      // console.log(결과);
      응답.render("blog-detail.ejs", {
        data: 결과,
        사용자: 요청.user,
        logged: true,
      });
    });
});

//게시물 등록
// write페이지가 로그인이 필수이기때문에 로그인 parameter함수 넣지 않음
// counter에 게시물갯수라는 값을 가진 name 키를 찾아서 그 값에 + 1 = 총게시물 갯수
// write페이지에 기록된 data들을 게시물정보라는 변수에 올바른 object 형식으로 저장
// 댓글이라는 빈 array도 미리 만들어준다
// post 컬랙션에 위 내용을 저장하고 counter 컬랙션에 있는 숫자 +1 시키기
app.post("/add", function (요청, 응답) {
  db.collection("counter")
    .findOne({ name: "게시물갯수" })
    .then((결과) => {
      // console.log(결과.totalPost);
      var 총게시물갯수 = 결과.totalPost;

      var 게시물정보 = {
        _id: 총게시물갯수 + 1,
        제목: 요청.body.title,
        // 2023년 7월 31일 월요일 오후 10:31
        // 작성일자: new Date().toLocaleDateString("ko-KR", {
        //   year: "numeric",
        //   month: "short",
        //   day: "numeric",
        //   weekday: "long",
        //   hour: "numeric",
        //   minute: "numeric",
        // }),
        작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
        날짜: 요청.body.duedate,
        내용: 요청.body.detail,
        작성자: 요청.user._id,
        작성자id: 요청.user.id,
        checked: "false",
        댓글: [],
      };
      db.collection("post")
        .insertOne(게시물정보)
        .then((결과) => {
          console.log("저장완료");
          db.collection("counter")
            .updateOne({ name: "게시물갯수" }, { $inc: { totalPost: 1 } })
            .then((결과) => {
              db.collection("counter")
                .insertOne({
                  name: 총게시물갯수 + 1,
                  totalReply: 0,
                })
                .then((결과) => {
                  //성공하면 할일 게시물의 detail 페이지로 이동
                  응답.redirect(`/todo-detail/${총게시물갯수 + 1}`);
                });
            });
        });
    });
});

// 카테고리 불러오기
app.get("/blog-category", function (요청, 응답) {
  db.collection("category")
    .findOne({ type: "blog" })
    .then((결과) => {
      // console.log(결과);
      응답.send(결과);
    })
    .catch((에러) => {
      console.log(에러);
    });
});

//전체 할일 포스팅 갯수 파악
app.get("/todo-total-post", function (요청, 응답) {
  db.collection("post")
    .find()
    .toArray()
    .then((결과) => {
      // console.log(결과);
      // console.log(요청.user);
      응답.send(결과);
    });
});

//전체 블로그 포스팅 갯수 파악
app.get("/blog-total-post", function (요청, 응답) {
  db.collection("blogPost")
    .find()
    .toArray()
    .then((결과) => {
      // console.log(결과);
      // console.log(요청.user);
      응답.send(결과);
    });
});

// 카테고리별 게시물 갯수 파악 (보류)
app.get("/blog-category-count", function (요청, 응답) {
  // console.log(요청.query.category);
  db.collection("blogPost")
    .find({ 카테고리: 요청.query.category })
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.send(결과);
    })
    .catch((에러) => {
      console.log(에러);
    });
});

// 게시물 삭제 (할일 리스트 게시물 삭제)
// 요청 페이지에 내장되어있던 _id값과 요청한 user의 id를 가져와서
// DB에서 검색 (둘다 만족하는 data가 있어야 삭제 가능)
// 만약 관리자라면 _id만 가지고 삭제 가능하도록 설계
app.delete("/todo-delete", function (요청, 응답) {
  // console.log(요청.body);
  요청.body._id = parseInt(요청.body._id);
  //요청.body._id는 게시물 번호 / 요청.user._id는 로그인 한 유저의 userId
  var 작성자삭제 = { _id: 요청.body._id, 작성자: 요청.user._id };
  var 관리자삭제 = { _id: 요청.body._id };
  // 관리자일 경우 요청.body._id만 검색해서 삭제

  if (요청.user.admin === true) {
    db.collection("post")
      .deleteOne(관리자삭제)
      .then((결과) => {
        // console.log(결과);
        응답.status(200).send({ message: "성공했습니다" });
      })
      .catch((에러) => {
        console.log(에러);
      });
  } else {
    db.collection("post")
      .deleteOne(작성자삭제)
      .then((결과) => {
        console.log(결과);
        응답.status(200).send({ message: "성공했습니다" });
      })
      .catch((에러) => {
        console.log(에러);
      });
  }
});

//게시물 삭제 (블로그)
app.delete("/blog-delete", function (요청, 응답) {
  // console.log(요청.body);
  요청.body._id = parseInt(요청.body._id);
  //요청.body._id는 게시물 번호 / 요청.user._id는 로그인 한 유저의 userId
  var 작성자삭제 = { _id: 요청.body._id, 작성자: 요청.user._id };
  var 관리자삭제 = { _id: 요청.body._id };
  // 관리자일 경우 요청.body._id만 검색해서 삭제

  if (요청.user.admin === true) {
    db.collection("blogPost")
      .deleteOne(관리자삭제)
      .then((결과) => {
        // console.log(결과);
        응답.status(200).send({ message: "성공했습니다" });
      })
      .catch((에러) => {
        console.log(에러);
      });
  } else {
    db.collection("blogPost")
      .deleteOne(작성자삭제)
      .then((결과) => {
        console.log(결과);
        응답.status(200).send({ message: "성공했습니다" });
      })
      .catch((에러) => {
        console.log(에러);
      });
  }
});

//검색기능 추가
app.get("/todo-search", 로그인했니, (요청, 응답) => {
  // console.log(요청.query.value);
  var 검색조건 = [
    {
      $search: {
        index: "titleSearch",
        text: {
          query: 요청.query.value,
          path: ["제목", "내용"], // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
        },
      },
    },
    // { $sort: { _id: 1 } },
    // { $limit: 10 },
    // { $project: { 제목: 1, _id: 0, score: { $meta: "searchScore" } } },
  ];
  db.collection("post")
    .aggregate(검색조건)
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.render("todo-search.ejs", {
        data: 결과,
        사용자: 요청.user,
        logged: true,
      });
    });
});

//검색기능 추가
app.get("/blog-search", 로그인했니, (요청, 응답) => {
  // console.log(요청.query.value);
  var 검색조건 = [
    {
      $search: {
        index: "blogSearch",
        text: {
          query: 요청.query.value,
          path: ["제목", "내용"], // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
        },
      },
    },
    // { $sort: { _id: 1 } },
    // { $limit: 10 },
    // { $project: { 제목: 1, _id: 0, score: { $meta: "searchScore" } } },
  ];
  db.collection("blogPost")
    .aggregate(검색조건)
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.render("blog-search.ejs", {
        data: 결과,
        사용자: 요청.user,
        logged: true,
      });
    });
});

//검색기능 추가
app.get("/blog-category-list", 로그인했니, (요청, 응답) => {
  // console.log(요청.query.value);
  var 검색조건 = [
    {
      $search: {
        index: "blogSearch",
        text: {
          query: 요청.query.value,
          path: "카테고리", // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
        },
      },
    },
    // { $sort: { _id: 1 } },
    // { $limit: 10 },
    // { $project: { 제목: 1, _id: 0, score: { $meta: "searchScore" } } },
  ];
  db.collection("blogPost")
    .aggregate(검색조건)
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.render("blog-category.ejs", {
        data: 결과,
        사용자: 요청.user,
        logged: true,
      });
    });
});

app.get("/", function (요청, 응답) {
  if (요청.user == undefined) {
    응답.render("index.ejs", { logged: false });
  } else {
    응답.render("index.ejs", { logged: true, 사용자: 요청.user });
  }
});

app.get("/todo-write", 로그인했니, function (요청, 응답) {
  응답.render("todo-write.ejs", { logged: true, 사용자: 요청.user });
});

app.get("/login", 로그인안했니, function (요청, 응답) {
  응답.render("login.ejs", { logged: false });
});

app.get("/signup", 로그인안했니, function (요청, 응답) {
  응답.render("signup.ejs", { logged: false });
});

app.get("/mypage", 로그인했니, function (요청, 응답) {
  console.log(요청.user);
  응답.render("mypage.ejs", { 사용자: 요청.user, logged: true });
});

app.get("/blog-write", 로그인했니, function (요청, 응답) {
  응답.render("blog-write.ejs", { logged: true, 사용자: 요청.user });
});

app.get("/standings", function (요청, 응답) {
  if (요청.user == undefined) {
    응답.render("standings.ejs", { logged: false });
  } else {
    응답.render("standings.ejs", { 사용자: 요청.user, logged: true });
  }
});

app.post("/blog-category-edit", 로그인했니, function (요청, 응답) {
  db.collection("category")
    .updateOne(
      //edit 페이지에 내장된 id의 값을 받아서
      //post 컬랙션의 _id의 key값으로 조회
      //조회가 되면 $set을 통해 _id, 제목, 날짜, 내용 수정
      { type: "blog" },
      {
        $set: {
          category: 요청.body.category,
        },
      }
    )

    .then((성공) => {
      console.log("저장성공");
      응답.send("DB저장 성공");
    });
});

function 로그인했니(요청, 응답, next) {
  if (요청.user) {
    next();
  } else {
    응답.render("login.ejs");
  }
}

function 로그인안했니(요청, 응답, next) {
  if (!요청.user) {
    next();
  } else {
    const message = encodeURIComponent("로그인한 상태입니다.");
    응답.redirect(`/?error=${message}`);
  }
}

app.get("/upload", 로그인했니, function (요청, 응답) {
  응답.render("upload.ejs", { logged: true, 사용자: 요청.user });
});

app.post(
  "/upload",
  로그인했니,
  upload.single("uploadFile"),
  function (요청, 응답) {
    응답.send("업로드완료");
  }
);

app.get("/image/:fileName", function (요청, 응답) {
  응답.sendFile(__dirname + "/public/image/" + 요청.params.fileName);
});
app.get("/image/favicon/:fileName", function (요청, 응답) {
  응답.sendFile(__dirname + "/public/image/favicon/" + 요청.params.fileName);
});

//edit 전환
app.get("/todo-edit/:id", 로그인했니, function (요청, 응답) {
  db.collection("post")
    .findOne({ _id: parseInt(요청.params.id) })
    .then((결과) => {
      // console.log(결과);
      응답.render("todo-edit.ejs", {
        data: 결과,
        사용자: 요청.user,
        logged: true,
      });
    });
});

app.get("/blog-edit/:id", 로그인했니, function (요청, 응답) {
  db.collection("blogPost")
    .findOne({ _id: parseInt(요청.params.id) })
    .then((결과) => {
      // console.log(결과);
      응답.render("blog-edit.ejs", {
        data: 결과,
        사용자: 요청.user,
        logged: true,
      });
    });
});

// login fail시 redirect
app.get("/loginfail", function (요청, 응답) {
  응답.render("loginfail.ejs", { logged: false });
});

// 채팅방 오픈
// /chatroom으로 post요청하면
//  { member : [채팅당한 유저의 _id, 채팅건 유저의 _id], date : 지금날짜, title : 채팅방이름(아무거나) }
// 같이 collection에 object추가
app.post("/chatroom", 로그인했니, (요청, 응답) => {
  var 게시물정보 = {
    member: [요청.body.writerId, 요청.user._id.toString()],
    memberId: [요청.body.writer, 요청.user.id],
    date: new Date(),
    title: 요청.body.chatTitle,
  };
  console.log(게시물정보);

  db.collection("chatroom")
    .insertOne(게시물정보)
    .then((결과) => {
      응답.redirect("/");
    });
});

app.get("/chat", 로그인했니, function (요청, 응답) {
  console.log(요청.user._id.toString());

  db.collection("chatroom")
    .find({
      member: 요청.user._id.toString(),
    })
    .toArray()
    .then((결과) => {
      console.log(결과);
      console.log(요청.user);
      응답.render("chat.ejs", { data: 결과, 사용자: 요청.user, logged: true });
    });
});

app.post("/message", 로그인했니, function (요청, 응답) {
  var 저장할거 = {
    parent: 요청.body.parentPost,
    content: 요청.body.content,
    userId: 요청.user._id,
    date: new Date(),
  };

  db.collection("message")
    .insertOne(저장할거)
    .then((성공) => {
      console.log("저장성공");
      응답.send("DB저장 성공");
    });
});

app.get("/message/:parentId", 로그인했니, function (요청, 응답) {
  응답.writeHead(200, {
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });
  db.collection("message")
    .find({ parent: 요청.params.parentId })
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.write("event: chat\n");
      응답.write("data:" + JSON.stringify(결과) + "\n\n");
    });

  const 찾을문서 = [
    { $match: { "fullDocument.parent": 요청.params.parentId } },
  ];

  const changeStream = db.collection("message").watch(찾을문서);
  changeStream.on("change", (result) => {
    //마지막으로 추가된 데이터
    // console.log([result.fullDocument]);
    var 추가된문서 = [result.fullDocument];
    응답.write("event: chat\n");
    응답.write(`data: ${JSON.stringify(추가된문서)}\n\n`);
  });
});

app.get("/socket", 로그인했니, function (요청, 응답) {
  응답.render("socket.ejs", { 사용자: 요청.user, logged: true });
});

//socket.io 채팅
// io.emit  == 접속된 모든 클라이언트에게 메세지 전송
// socket.emit    == 메세지를 전송한 클라이언트에게만 전송
// io.to(id).emit == 특정 클라이언트에게만 메세지 전송 (본인 포함)
// socket.broadcast.to(id).emit == 본인은 제외한 특정 클라이언트에게만 전송
// socket.emit('message', '서버 데이터 받음');
// socket.on('이벤트명',기능 서술) == 서버 또는 클라이언트에서 메세지를 받는 방식

io.on("connection", function (socket) {
  // Accept a login event with user's data
  socket.on("login", function (data) {
    console.log(data.name + " 접속됨");
    // broadcasting a entering message to everyone who is in the chatroom
    io.emit("login", data.name + "님이 접속하였습니다.");

    socket.name = data.name;
    socket.userIcon = data.userIcon;
  });

  // socket.on("join-room", function (data) {
  //   socket.join(data);
  // });

  // 메시지를 전송한 클라이언트를 제외한 모든 클라이언트에게 메시지를 전송한다
  socket.on("user-send", function (data) {
    var time = dayjs().tz().format("A hh:mm");
    socket.broadcast.emit("broadcast", [
      socket.name,
      data,
      time,
      socket.userIcon,
    ]);
  });

  // 메시지를 전송한 클라이언트에게만 메시지를 전송한다
  // socket.emit('s2c chat', msg);

  // 접속된 모든 클라이언트에게 메시지를 전송한다
  // io.emit('s2c chat', msg);

  // 특정 클라이언트에게만 메시지를 전송한다
  // io.to(id).emit('s2c chat', data);

  socket.on("disconnect", function (data) {
    io.emit("logout", socket.name + "님이 접속을 종료하였습니다.");
  });

  // socket.on("room1-send", function (data) {
  //   io.to("room1").emit("broadcast", data);
  // });
});

//댓글 작성 구현 (할일 댓글)
app.post("/replyAdd", 로그인했니, function (요청, 응답) {
  db.collection("counter")
    .findOne({ name: parseInt(요청.body.postId) })
    .then((결과) => {
      // console.log(결과.totalPost);
      var 총게시물갯수 = 결과.totalReply;

      var 게시물정보 = {
        _id: 총게시물갯수 + 1,
        내용: 요청.body.reply,
        작성자: 요청.user._id,
        작성자id: 요청.user.id,
        작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
        아이콘: 요청.user.role,
        // 작성일자: new Date().toLocaleDateString("ko-KR", {
        //   year: "numeric",
        //   month: "short",
        //   day: "numeric",
        //   weekday: "long",
        //   hour: "numeric",
        //   minute: "numeric",
        // }),
      };

      db.collection("post")
        .updateOne(
          { _id: parseInt(요청.body.postId) },
          {
            $push: { 댓글: 게시물정보 },
          }
        )
        .then((결과) => {
          console.log("입력완료");
          db.collection("counter")
            .updateOne(
              { name: parseInt(요청.body.postId) },
              { $inc: { totalReply: 1 } }
            )
            .then((결과) => {
              응답.redirect("back");
            });
        });
    });
});

//댓글 작성 구현 (블로그 댓글)
app.post("/blogReplyAdd", 로그인했니, function (요청, 응답) {
  db.collection("counter")
    .findOne({ name: "blog" + 요청.body.postId })
    .then((결과) => {
      // console.log(결과.totalPost);
      var 총게시물갯수 = parseInt(결과.totalReply);

      var 게시물정보 = {
        _id: 총게시물갯수 + 1,
        내용: 요청.body.reply,
        작성자: 요청.user._id,
        작성자id: 요청.user.id,
        작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
        아이콘: 요청.user.role,
        // 작성일자: new Date().toLocaleDateString("ko-KR", {
        //   year: "numeric",
        //   month: "short",
        //   day: "numeric",
        //   weekday: "long",
        //   hour: "numeric",
        //   minute: "numeric",
        // }),
      };

      db.collection("blogPost")
        .updateOne(
          { _id: parseInt(요청.body.postId) },
          {
            $push: { 댓글: 게시물정보 },
          }
        )
        .then((결과) => {
          console.log("입력완료");
          db.collection("counter")
            .updateOne(
              { name: "blog" + 요청.body.postId },
              { $inc: { totalReply: 1 } }
            )
            .then((결과) => {
              응답.redirect("back");
            });
        });
    });
});

// check function 구현
app.put("/checked", 로그인했니, function (요청, 응답) {
  db.collection("post")
    .updateOne(
      //edit 페이지에 내장된 id의 값을 받아서
      //post 컬랙션의 _id의 key값으로 조회
      //조회가 되면 $set을 통해 _id, 제목, 날짜, 내용 수정
      { _id: parseInt(요청.body._id) },
      {
        $set: {
          checked: 요청.body.checked,
        },
      }
    )
    //성공하면 list페이지로 이동
    .then((결과) => {
      console.log("수정완료");
    });
});

// 댓글 삭제
// detail 페이지에서 전송된 ajax내용중
// data: {_id: 글번호}를 이용하여
// DB내 해당 _id를 가진 댓글 (the object in Array)을 찾아서
app.put("/reply-delete", function (요청, 응답) {
  console.log(요청.body._id);
  console.log(요청.user._id);
  요청.body._id = parseInt(요청.body._id);
  //요청.body._id는 게시물 번호 / 요청.user._id는 로그인 한 유저의 userId
  var 삭제할데이터 = { _id: 요청.body._id, 작성자: 요청.user._id };
  var 관리자삭제 = { _id: 요청.body._id };
  // 관리자일 경우 요청.body._id만 검색해서 삭제

  if (요청.user.admin === true) {
    db.collection("post")
      .updateOne(
        { 댓글: { $elemMatch: 관리자삭제 } },
        { $pull: { 댓글: 관리자삭제 } }
      )
      .then((결과) => {
        console.log(결과);
        응답.status(200).send({ message: "성공했습니다" });
      })
      .catch((에러) => {
        console.log(에러);
      });
  } else {
    db.collection("post")
      .updateOne(
        { 댓글: { $elemMatch: 삭제할데이터 } },
        { $pull: { 댓글: 삭제할데이터 } }
      )
      .then((결과) => {
        console.log(결과);
        응답.status(200).send({ message: "성공했습니다" });
      })
      .catch((에러) => {
        console.log(에러);
      });
  }
});

// 댓글 삭제 (블로그 댓글 삭제)
app.put("/blog-reply-delete", function (요청, 응답) {
  console.log(요청.body._id);
  console.log(요청.user._id);
  요청.body._id = parseInt(요청.body._id);
  //요청.body._id는 게시물 번호 / 요청.user._id는 로그인 한 유저의 userId
  var 삭제할데이터 = { _id: 요청.body._id, 작성자: 요청.user._id };
  var 관리자삭제 = { _id: 요청.body._id };
  // 관리자일 경우 요청.body._id만 검색해서 삭제

  if (요청.user.admin === true) {
    db.collection("blogPost")
      .updateOne(
        { 댓글: { $elemMatch: 관리자삭제 } },
        { $pull: { 댓글: 관리자삭제 } }
      )
      .then((결과) => {
        console.log(결과);
        응답.status(200).send({ message: "성공했습니다" });
      })
      .catch((에러) => {
        console.log(에러);
      });
  } else {
    db.collection("blogPost")
      .updateOne(
        { 댓글: { $elemMatch: 삭제할데이터 } },
        { $pull: { 댓글: 삭제할데이터 } }
      )
      .then((결과) => {
        console.log(결과);
        응답.status(200).send({ message: "성공했습니다" });
      })
      .catch((에러) => {
        console.log(에러);
      });
  }
});

// 댓글 수정 (할일 댓글 수정)
//
app.put("/reply-edit", 로그인했니, function (요청, 응답) {
  요청.body.postId = parseInt(요청.body.postId);
  요청.body._id = parseInt(요청.body._id);
  //요청.body._id는 게시물 번호 / 요청.user._id는 로그인 한 유저의 userId
  var 수정할데이터 = { _id: 요청.body._id, 작성자: 요청.user._id };
  var 관리자수정 = { _id: 요청.body._id };
  // console.log(수정할데이터);
  // console.log(관리자수정);
  // 관리자일 경우 요청.body._id만 검색해서 삭제

  if (요청.user.admin === true) {
    db.collection("post")
      .updateOne(
        { _id: 요청.body.postId, 댓글: { $elemMatch: 관리자수정 } },

        {
          $set: {
            "댓글.$": {
              _id: 요청.body._id,
              내용: 요청.body.detail,
              작성자: 요청.body.작성자,
              작성자id: 요청.body.작성자id,
              작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
              아이콘: 요청.body.작성자icon,
            },
          },
        }
      )
      .then((결과) => {
        console.log(결과);

        응답.redirect("/todo-detail/" + 요청.body.postId);
      })
      .catch((에러) => {
        console.log(에러);
      });
  } else {
    db.collection("post")
      .updateOne(
        { _id: 요청.body.postId, 댓글: { $elemMatch: 수정할데이터 } },
        {
          $set: {
            "댓글.$": {
              _id: 요청.body._id,
              내용: 요청.body.detail,
              작성자: 요청.user._id,
              작성자id: 요청.user.id,
              작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
              아이콘: 요청.body.작성자icon,
            },
          },
        }
      )
      .then((결과) => {
        console.log(결과);

        응답.redirect("/todo-detail/" + 요청.body.postId);
      })
      .catch((에러) => {
        console.log(에러);
      });
  }
});

// 댓글 수정 (블로그 댓글 수정)
app.put("/blog-reply-edit", 로그인했니, function (요청, 응답) {
  요청.body.postId = parseInt(요청.body.postId);
  요청.body._id = parseInt(요청.body._id);
  //요청.body._id는 게시물 번호 / 요청.user._id는 로그인 한 유저의 userId
  var 수정할데이터 = { _id: 요청.body._id, 작성자: 요청.user._id };
  var 관리자수정 = { _id: 요청.body._id };
  // console.log(수정할데이터);
  // console.log(관리자수정);
  // 관리자일 경우 요청.body._id만 검색해서 삭제

  if (요청.user.admin === true) {
    db.collection("blogPost")
      .updateOne(
        { _id: 요청.body.postId, 댓글: { $elemMatch: 관리자수정 } },

        {
          $set: {
            "댓글.$": {
              _id: 요청.body._id,
              내용: 요청.body.detail,
              작성자: 요청.body.작성자,
              작성자id: 요청.body.작성자id,
              작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
              아이콘: 요청.body.작성자icon,
            },
          },
        }
      )
      .then((결과) => {
        console.log(결과);

        응답.redirect("/blog-detail/" + 요청.body.postId);
      })
      .catch((에러) => {
        console.log(에러);
      });
  } else {
    db.collection("blogPost")
      .updateOne(
        { _id: 요청.body.postId, 댓글: { $elemMatch: 수정할데이터 } },
        {
          $set: {
            "댓글.$": {
              _id: 요청.body._id,
              내용: 요청.body.detail,
              작성자: 요청.user._id,
              작성자id: 요청.user.id,
              작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
              아이콘: 요청.body.작성자icon,
            },
          },
        }
      )
      .then((결과) => {
        console.log(결과);

        응답.redirect("/blog-detail/" + 요청.body.postId);
      })
      .catch((에러) => {
        console.log(에러);
      });
  }
});

// 블로그 글쓰기 기능
app.post("/blog-add", 로그인했니, function (요청, 응답) {
  if (요청.body.thumb) {
    db.collection("counter")
      .findOne({ name: "블로그갯수" })
      .then((결과) => {
        // console.log(결과.totalPost);
        var 총게시물갯수 = 결과.totalPost;

        var 게시물정보 = {
          _id: 총게시물갯수 + 1,
          카테고리: 요청.body.category,
          제목: 요청.body.title,
          작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
          내용: 요청.body.detail,
          작성자: 요청.user._id,
          작성자id: 요청.user.id,
          이미지: 요청.body.thumb,
          아이콘: 요청.user.role,
          댓글: [],
        };
        db.collection("blogPost")
          .insertOne(게시물정보)
          .then((결과) => {
            console.log("저장완료");
            db.collection("counter")
              .updateOne({ name: "블로그갯수" }, { $inc: { totalPost: 1 } })
              .then((결과) => {
                db.collection("counter")
                  .insertOne({
                    name: "blog" + (총게시물갯수 + 1),
                    totalReply: 0,
                  })
                  .then((결과) => {
                    응답.redirect(`/blog-detail/${총게시물갯수 + 1}`);
                  });
              });
          });
      });
  } else {
    db.collection("counter")
      .findOne({ name: "블로그갯수" })
      .then((결과) => {
        // console.log(결과.totalPost);
        var 총게시물갯수 = 결과.totalPost;

        var 게시물정보 = {
          _id: 총게시물갯수 + 1,
          카테고리: 요청.body.category,
          제목: 요청.body.title,
          작성일자: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
          내용: 요청.body.detail,
          작성자: 요청.user._id,
          작성자id: 요청.user.id,
          이미지: "/image/icon-image-not-found.jpg",
          아이콘: 요청.user.role,
          댓글: [],
        };
        db.collection("blogPost")
          .insertOne(게시물정보)
          .then((결과) => {
            console.log("저장완료");
            db.collection("counter")
              .updateOne({ name: "블로그갯수" }, { $inc: { totalPost: 1 } })
              .then((결과) => {
                db.collection("counter")
                  .insertOne({
                    name: "blog" + (총게시물갯수 + 1),
                    totalReply: 0,
                  })
                  .then((결과) => {
                    응답.redirect(`/blog-detail/${총게시물갯수 + 1}`);
                  });
              });
          });
      });
  }
});

app.get("/logout", function (요청, 응답, next) {
  요청.logout(function (에러) {
    if (에러) {
      return next(err);
    } else {
      // console.log("로그아웃됨");
      응답.redirect("/");
    }
  });
});

app.get("/todo-today", function (요청, 응답) {
  db.collection("post")
    .find({ 날짜: dayjs().tz().format("YYYY년 MM월 DD일") })
    .limit(5)
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.send(결과);
    })
    .catch((에러) => {
      console.log(에러);
    });
});

app.get("/blog-latest", function (요청, 응답) {
  db.collection("blogPost")
    .find()
    .sort({ _id: -1 })
    .limit(5)
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.send(결과);
    })
    .catch((에러) => {
      console.log(에러);
    });
});

app.post("/sumInsertImage", upload.single("img"), function (요청, 응답) {
  imgurl = "";
  if (요청.file !== undefined) {
    var imgurl = `/image/${요청.file.filename}`; // router에서 붙인 multer가 반환한 url (aws s3 object url)
  }
  // console.log(imgurl);
  응답.json(imgurl); // json 형태로 반환해주어야 View에서 처리가 가능하다.
});

app.post(
  "/thumbUpload",
  로그인했니,
  upload.single("image"),
  function (요청, 응답) {
    imgurl = "";
    if (요청.file !== undefined) {
      var imgurl = `/image/${요청.file.filename}`; // router에서 붙인 multer가 반환한 url (aws s3 object url)
    }
    // console.log(imgurl);
    응답.json(imgurl); // json 형태로 반환해주어야 View에서 처리가 가능하다.
  }
);

// 프리미어리그 순위 정보 업데이트
// API를 통해 JSON 형식 자료 받기 (PL)
app.get("/plUpdate", function (요청, 응답) {
  var premierLeague = 39;
  var laLiga = 140;
  var bundesLiga = 78;
  var serieA = 136;
  const options = {
    method: "GET",
    url: "https://api-football-v1.p.rapidapi.com/v3/standings",
    qs: {
      season: "2024",
      league: premierLeague,
    },
    headers: {
      "X-RapidAPI-Key": "6014370ca9mshff46ea7a34b8a9ap1087afjsnb17bf8b79747",
      "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    // console.log(body);

    const result = JSON.parse(body);
    var standings = result.response[0].league.standings[0];
    // console.log(standings);

    standings.forEach((element) => {
      var standingsData = {
        rank: element.rank,
        teamName: element.team.name,
        teamId: element.team.id,
        teamLogo: element.team.logo,
        points: element.points,
        played: element.all.played,
        win: element.all.win,
        draw: element.all.draw,
        lose: element.all.lose,
        goalsDiff: element.goalsDiff,
        form: element.form,
        update: element.update,
      };
      console.log(standingsData);

      // 받은 자료의 standings 배열의 각 팀별 자료를 DB에 각각의 document로 저장
      db.collection("premierLeague")
        .updateOne(
          { teamId: standingsData.teamId },
          { $set: standingsData },
          { upsert: true }
        )
        .then((result) => {
          console.log(standingsData.teamName + "업데이트완료");
        });
    });
    응답.status(200).send({ message: "성공했습니다" });
  });
});

app.get("/plstanding", function (요청, 응답) {
  db.collection("premierLeague")
    .find()
    .sort({ rank: 1 })
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.send(결과);
    })
    .catch((에러) => {
      console.log(에러);
    });
});

// 라리가 순위 정보 업데이트
// API를 통해 JSON 형식 자료 받기 (LL)
app.get("/llUpdate", function (요청, 응답) {
  var premierLeague = 39;
  var laLiga = 140;
  var bundesLiga = 78;
  var serieA = 136;
  const options = {
    method: "GET",
    url: "https://api-football-v1.p.rapidapi.com/v3/standings",
    qs: {
      season: "2024",
      league: laLiga,
    },
    headers: {
      "X-RapidAPI-Key": "6014370ca9mshff46ea7a34b8a9ap1087afjsnb17bf8b79747",
      "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    // console.log(body);

    const result = JSON.parse(body);
    var standings = result.response[0].league.standings[0];
    // console.log(standings);

    standings.forEach((element) => {
      var standingsData = {
        rank: element.rank,
        teamName: element.team.name,
        teamId: element.team.id,
        teamLogo: element.team.logo,
        points: element.points,
        played: element.all.played,
        win: element.all.win,
        draw: element.all.draw,
        lose: element.all.lose,
        goalsDiff: element.goalsDiff,
        form: element.form,
        update: element.update,
      };
      console.log(standingsData);

      // 받은 자료의 standings 배열의 각 팀별 자료를 DB에 각각의 document로 저장
      db.collection("laLiga")
        .updateOne(
          { teamId: standingsData.teamId },
          { $set: standingsData },
          { upsert: true }
        )
        .then((result) => {
          console.log(standingsData.teamName + "업데이트완료");
        });
    });
    응답.status(200).send({ message: "성공했습니다" });
  });
});

app.get("/llstanding", function (요청, 응답) {
  db.collection("laLiga")
    .find()
    .sort({ rank: 1 })
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.send(결과);
    })
    .catch((에러) => {
      console.log(에러);
    });
});

// 분데스리가 순위 정보 업데이트
// API를 통해 JSON 형식 자료 받기 (BL)
app.get("/blUpdate", function (요청, 응답) {
  var premierLeague = 39;
  var laLiga = 140;
  var bundesLiga = 78;
  var serieA = 136;
  const options = {
    method: "GET",
    url: "https://api-football-v1.p.rapidapi.com/v3/standings",
    qs: {
      season: "2024",
      league: bundesLiga,
    },
    headers: {
      "X-RapidAPI-Key": "6014370ca9mshff46ea7a34b8a9ap1087afjsnb17bf8b79747",
      "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    // console.log(body);

    const result = JSON.parse(body);
    var standings = result.response[0].league.standings[0];
    // console.log(standings);

    standings.forEach((element) => {
      var standingsData = {
        rank: element.rank,
        teamName: element.team.name,
        teamId: element.team.id,
        teamLogo: element.team.logo,
        points: element.points,
        played: element.all.played,
        win: element.all.win,
        draw: element.all.draw,
        lose: element.all.lose,
        goalsDiff: element.goalsDiff,
        form: element.form,
        update: element.update,
      };
      console.log(standingsData);

      // 받은 자료의 standings 배열의 각 팀별 자료를 DB에 각각의 document로 저장
      db.collection("bundesLiga")
        .updateOne(
          { teamId: standingsData.teamId },
          { $set: standingsData },
          { upsert: true }
        )
        .then((result) => {
          console.log(standingsData.teamName + "업데이트완료");
        });
    });
    응답.status(200).send({ message: "성공했습니다" });
  });
});

app.get("/blstanding", function (요청, 응답) {
  db.collection("bundesLiga")
    .find()
    .sort({ rank: 1 })
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.send(결과);
    })
    .catch((에러) => {
      console.log(에러);
    });
});

// 세리에A 순위 정보 업데이트
// API를 통해 JSON 형식 자료 받기 (SA)
app.get("/saUpdate", function (요청, 응답) {
  var premierLeague = 39;
  var laLiga = 140;
  var bundesLiga = 78;
  var serieA = 135;
  const options = {
    method: "GET",
    url: "https://api-football-v1.p.rapidapi.com/v3/standings",
    qs: {
      season: "2024",
      league: serieA,
    },
    headers: {
      "X-RapidAPI-Key": "6014370ca9mshff46ea7a34b8a9ap1087afjsnb17bf8b79747",
      "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    // console.log(body);

    const result = JSON.parse(body);
    var standings = result.response[0].league.standings[0];
    // console.log(standings);

    standings.forEach((element) => {
      var standingsData = {
        rank: element.rank,
        teamName: element.team.name,
        teamId: element.team.id,
        teamLogo: element.team.logo,
        points: element.points,
        played: element.all.played,
        win: element.all.win,
        draw: element.all.draw,
        lose: element.all.lose,
        goalsDiff: element.goalsDiff,
        form: element.form,
        update: element.update,
      };
      console.log(standingsData);

      // 받은 자료의 standings 배열의 각 팀별 자료를 DB에 각각의 document로 저장
      db.collection("serieA")
        .updateOne(
          { teamId: standingsData.teamId },
          { $set: standingsData },
          { upsert: true }
        )
        .then((result) => {
          console.log(standingsData.teamName + "업데이트완료");
        });
    });
    응답.status(200).send({ message: "성공했습니다" });
  });
});

app.get("/saStanding", function (요청, 응답) {
  db.collection("serieA")
    .find()
    .sort({ rank: 1 })
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.send(결과);
    })
    .catch((에러) => {
      console.log(에러);
    });
});

app.get("/playerUpdate", async (요청, 응답) => {
  let 결과 = await db.collection("playerInfo").find().toArray();
  if (!결과) return 응답.status(404).json({ message: "참가자 없음" });
  결과.forEach((element) => {
    let plPoints;
    var plPlayed;
    var plWin;
    var plDraw;
    var plLose;
    var plGoalsDiff;
    var plTeamName;
    var plTeamLogo;
    var plTeamForm;

    var llPoints;
    var llPlayed;
    var llWin;
    var llDraw;
    var llLose;
    var llGoalsDiff;
    var llTeamName;
    var llTeamLogo;
    var llTeamForm;

    var blPoints;
    var blPlayed;
    var blWin;
    var blDraw;
    var blLose;
    var blGoalsDiff;
    var blTeamName;
    var blTeamLogo;
    var blTeamForm;

    var saPoints;
    var saPlayed;
    var saWin;
    var saDraw;
    var saLose;
    var saGoalsDiff;
    var saTeamName;
    var saTeamLogo;
    var saTeamForm;

    var totalCupPoint;

    db.collection("playerStanding")
      .findOne({ player: element.player })
      .then((결과) => {
        totalCupPoint = 결과.totalCupPoint;
      });

    db.collection("premierLeague")
      .findOne({ teamId: parseInt(element.pl) })
      .then((결과) => {
        plPoints = 결과.points;
        plPlayed = 결과.played;
        plWin = 결과.win;
        plDraw = 결과.draw;
        plLose = 결과.lose;
        plGoalsDiff = 결과.goalsDiff;
        plTeamName = 결과.teamName;
        plTeamLogo = 결과.teamLogo;
        plTeamForm = 결과.form;
        // plChamps = 결과.champs;
        // plEuropa = 결과.europa;
        // plConference = 결과.conference;
        // plLeagueCup = 결과.leagueCup;
        // if (plChamps == true) {
        //   plCupPoint += 20;
        // }
        // if (plEuropa == true) {
        //   plCupPoint += 15;
        // }
        // if (plConference == true) {
        //   plCupPoint += 10;
        // }
        // if (plLeagueCup == true) {
        //   plCupPoint += 7;
        // }
      });

    db.collection("laLiga")
      .findOne({ teamId: parseInt(element.ll) })
      .then((결과) => {
        llPoints = 결과.points;
        llPlayed = 결과.played;
        llWin = 결과.win;
        llDraw = 결과.draw;
        llLose = 결과.lose;
        llGoalsDiff = 결과.goalsDiff;
        llTeamName = 결과.teamName;
        llTeamLogo = 결과.teamLogo;
        llTeamForm = 결과.form;
      });

    db.collection("bundesLiga")
      .findOne({ teamId: parseInt(element.bl) })
      .then((결과) => {
        blPoints = 결과.points;
        blPlayed = 결과.played;
        blWin = 결과.win;
        blDraw = 결과.draw;
        blLose = 결과.lose;
        blGoalsDiff = 결과.goalsDiff;
        blTeamName = 결과.teamName;
        blTeamLogo = 결과.teamLogo;
        blTeamForm = 결과.form;
      });

    db.collection("serieA")
      .findOne({ teamId: parseInt(element.sa) })
      .then((결과) => {
        saPoints = 결과.points;
        saPlayed = 결과.played;
        saWin = 결과.win;
        saDraw = 결과.draw;
        saLose = 결과.lose;
        saGoalsDiff = 결과.goalsDiff;
        saTeamName = 결과.teamName;
        saTeamLogo = 결과.teamLogo;
        saTeamForm = 결과.form;
      });

    setTimeout(function () {
      var totalPoints =
        parseInt(plPoints) +
        parseInt(llPoints) +
        parseInt(blPoints) +
        parseInt(saPoints) +
        parseInt(totalCupPoint);
      // console.log("totalPoints : " + totalPoints);
      var totalPlayed =
        parseInt(plPlayed) +
        parseInt(llPlayed) +
        parseInt(blPlayed) +
        parseInt(saPlayed);
      // console.log("totalPlayed : " + totalPlayed);
      var totalWin =
        parseInt(plWin) + parseInt(llWin) + parseInt(blWin) + parseInt(saWin);
      // console.log("totalWin : " + totalWin);
      var totalDraw =
        parseInt(plDraw) +
        parseInt(llDraw) +
        parseInt(blDraw) +
        parseInt(saDraw);
      // console.log("totalDraw : " + totalDraw);
      var totalLose =
        parseInt(plLose) +
        parseInt(llLose) +
        parseInt(blLose) +
        parseInt(saLose);
      // console.log("totalLose : " + totalLose);
      var totalGoalsDiff =
        parseInt(plGoalsDiff) +
        parseInt(llGoalsDiff) +
        parseInt(blGoalsDiff) +
        parseInt(saGoalsDiff);
      // console.log("totalGoalsDiff : " + totalGoalsDiff);

      var standingsData = {
        player: element.player,
        totalPoints: totalPoints,
        totalPlayed: totalPlayed,
        totalWin: totalWin,
        totalDraw: totalDraw,
        totalLose: totalLose,
        totalGoalsDiff: totalGoalsDiff,
        // totalCupPoint: 0,
        pl: {
          teamName: plTeamName,
          teamLogo: plTeamLogo,
          win: plWin,
          draw: plDraw,
          lose: plLose,
          goalsDiff: plGoalsDiff,
          points: plPoints,
          form: plTeamForm,
        },
        ll: {
          teamName: llTeamName,
          teamLogo: llTeamLogo,
          win: llWin,
          draw: llDraw,
          lose: llLose,
          goalsDiff: llGoalsDiff,
          points: llPoints,
          form: llTeamForm,
        },
        bl: {
          teamName: blTeamName,
          teamLogo: blTeamLogo,
          win: blWin,
          draw: blDraw,
          lose: blLose,
          goalsDiff: blGoalsDiff,
          points: blPoints,
          form: blTeamForm,
        },
        sa: {
          teamName: saTeamName,
          teamLogo: saTeamLogo,
          win: saWin,
          draw: saDraw,
          lose: saLose,
          goalsDiff: saGoalsDiff,
          points: saPoints,
          form: saTeamForm,
        },
        update: dayjs().tz().format("YYYY-MM-DD(ddd) A hh:mm"),
      };

      console.log(standingsData);

      db.collection("playerStanding")
        .updateOne(
          { player: element.player },
          { $set: standingsData },
          { upsert: true }
        )
        .then((result) => {
          console.log(standingsData.player + "업데이트완료");
        });
    }, 1000);
  });
  응답.status(200).send({ message: "성공했습니다" });
});

app.get("/playerStanding", function (요청, 응답) {
  db.collection("playerStanding")
    .find()
    .sort({ totalPoints: -1, totalGoalsDiff: -1 })
    .toArray()
    .then((결과) => {
      // console.log(결과);
      응답.send(결과);
    })
    .catch((에러) => {
      console.log(에러);
    });
});

app.use((req, res, next) => {
  const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  error.status = 404;
  logger.error(error.message);
  next(error);
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV !== "production" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});
