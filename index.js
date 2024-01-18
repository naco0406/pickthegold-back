require('dotenv').config();
// 예시: 백엔드에서 MySQL 연결 설정
const fs = require('fs');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const axios = require('axios'); // 레포지토리 가져오기
const session = require('express-session');
const cors = require('cors');
const githubAuthRoutes = require('./routes/githubAuth');
const userController = require ('./lib/UserController');
const githubToken = process.env.GITHUB_TOKEN;
const mysql = require ('mysql2');

const connection = mysql.createConnection({
    host: '13.125.245.84',
    user:'jjy8301004',
    password: 'sanaya0813!!',
    database: 'madweek1',
    port: 3306
});

connection.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
    } else {
        console.log('Connected to MySQL');
    }
});

app.get('/api/user', (req, res) => {
    connection.query('SELECT * FROM user', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/readmes', (req, res) => {
  // Send the transformed README data to the client
  res.json(transformedReadmes);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));
app.use('/auth/github', githubAuthRoutes);

// app.post 

app.post('/signup', userController.register);

function findUserByEmail(email, callback) {
  const query = 'SELECT u.userClass, u.balance, GROUP_CONCAT(b.proj_id ORDER BY b.proj_id) as proj_ids FROM User u LEFT JOIN Bet b ON u.email = b.email WHERE u.email = ? GROUP BY u.email, u.userClass, u.balance';

  connection.query(query, [email], function(error, results) {
    console.log("=====EMAIL2: ", email)
    console.log("=====RESULTS: ", results)
      if (error) {
          console.error("SQL Error: ", error)
          callback(error, null);
          return;
      }

      if (results.length > 0) {

        const userInfo = {
            userclass: results[0].userClass,
            balance: results[0].balance,
            proj_ids: results[0].proj_ids ? results[0].proj_ids.split(','):[]


        };
          // 사용자가 있으면 userclass 반환
          callback(null, userInfo);

      } else {
          // 사용자가 없으면 -1 반환
          callback(null, "-1");
      }
  });
}

// URL에서 이메일 파라미터 처리
app.post('/api/checkClass', (req, res) => {
  const email = req.body.email;
  const balance = req.body.balance;
  
  console.log("=====EMAIL: ", email)
  findUserByEmail(email, function(error, result) {
      if (error) {
          res.status(500).send('Internal Server Error');
      } else {
        res.status(200).json(result);
      }
  });
}); 


// /api/getProjects 엔드포인트
app.get('/api/getProjects', (req, res) => {
  
  const userClass = 2; // 클래스 정보를 쿼리 파라미터로 받음

  if (!userClass) {
      return res.status(400).send('Class parameter is required');
  }

  findProjectByClass(userClass, function(error, projects) {
      if (error) {
          res.status(500).send('Error fetching projects');
      } else {
          res.status(200).json(projects);
      }
  });
});


app.post('/api/bet', (req, res) => {

    const { email, amount, proj_id } = req.body;

    connection.query('SELECT balance FROM User WHERE email =?',[email],(balanceError, balanceResults) => {

        if(balanceError) {
            return res.status(500).send('Error fetching user balance');
        }

        if(balanceResults.length ==0){
            return res.status(404).send('User not found');

        }

        let currentBalance = balanceResults[0].balance;

        if(currentBalance < amount) {
            return res.status(400).send('Insufficient Balance');
        }


        let updatedBalance = currentBalance - amount;

        connection.query('UPDATE User SET balance = ? WHERE email = ?',[updatedBalance, email], (updateError, updateResults) => {

        
            if(updateError) {
                return res.status(500).send('Error updating user balance');

            }

          res.status(200).json( updatedBalance);


            
        // bet 테이블은 걍 무조건 조건같은거 없음 
        const betQuery = 'INSERT INTO Bet (email, amount, proj_id) VALUES (?, ?, ?)';
        connection.query(betQuery, [email, amount, proj_id], (betError, betResults) => {
            if (betError) {
                return res.status(500).send('Error while placing bet');
            }

        // Odds 테이블은 proj_id 가 현재 있는지 봐야함 
        const oddsCheckQuery = 'SELECT * FROM Odds WHERE odds_id = ?';
        connection.query(oddsCheckQuery, [proj_id], (oddsError, oddsResults) => {
            if (oddsError) {
                return res.status(500).send('Error checking odds table');
            }

            if (oddsResults.length > 0) { // 이미 있는 경우 
       
                const updatedIdTotal = oddsResults[0].id_total + amount;
                const updateOddsQuery = 'UPDATE Odds SET id_total = ? WHERE odds_id = ?';                
                connection.query(updateOddsQuery, [updatedIdTotal, proj_id], (updateError, updateResults) => {
                        if (updateError) {
                            return res.status(500).send('Error updating odds table');
                        }
                    });
            } else {
                // 없으면 insert 
                const insertOddsQuery = 'INSERT INTO Odds (odds_id, id_total) VALUES (?, ?)';
                connection.query(insertOddsQuery, [proj_id, amount], (insertError, insertResults) => {
                    if (insertError) {
                        return res.status(500).send('Error inserting into odds table');
                    }
                });
            }

        });
    });
        });

    });
});

//bet 끝 



app.get('/api/getEndResult', (req,res)=>{


    connection.query ('SELECT nickname, balance FROM User',(err, results) => {

        if(err) {
            console.error('끝난 담에 유저 정보 주기 실패!! ', err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(results);
    });
});



app.get('/api/getEndTimes', (req, res) => {
    connection.query('SELECT end_time FROM Time', (err, results) => {
        if (err) {
            console.error('Error fetching end times:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(results);
    });
});



app.post('/api/betResult', async(req,res)=> {


    try {

        const clientTime = req.body.time;
        console.log('여기에 clienttime 있다!!',  clientTime);


        const endTime = new Date(clientTime);
        console.log('여기에 end time 있다!!',  endTime);

        endTime.setMinutes(endTime.getMinutes()+1);


        await connection.promise().query('UPDATE Time SET end_time = ? WHERE id = 1', [endTime]);

        
        console.log('여기에 end_Time 업데이트 했따!!',  clientTime);
        
        const [winningResults] = await connection.promise().query('SELECT result_id FROM Result WHERE pick = 1');
        console.log('여기에~~~ winning result id 있다요 !!!' ,winningResults); // 결과 로깅


        for (const result of winningResults) {
            const resultId = result.result_id;

            const [odds] = await connection.promise().query('SELECT (SELECT SUM(id_total) FROM Odds) / id_total AS rate FROM Odds WHERE odds_id = ?',[resultId]);
            console.log('여기에~~~ odds 있다요 !!!' , odds); // 결과 로깅

            if(odds.length > 0){
                const rate = odds[0].rate;

                const [bets] = await connection.promise().query('SELECT email, amount FROM Bet WHERE proj_id = ?', [resultId]);
                console.log('여기에~~~ bets 있다요 !!!' , bets); // 결과 로깅

                for (const bet of bets) {
                    const {email, amount} = bet;
                    
                    console.log('여기에 rate 이 있다!!', rate);
                    
                    const winnings = amount*rate;
                    console.log('여기에 winnings 있다 ', winnings);
                    const roundedWinnings = Math.round(winnings);
                  
                    console.log('여기에 winnings 있다 ', roundedWinnings);

                    console.log('여기에 email 있다 ', email);

                    await connection.promise().query('UPDATE User SET balance = balance + ? WHERE email = ?',[roundedWinnings, email]);
                    console.log('여기에~~~ winnings랑 email 있다요 !!!' , roundedWinnings,email ); // 결과 로깅

                }
            }
        }

        res.status(200).send('배팅 끝!! 발란스 추가 완료');
        

    } catch (error) {
        console.error('배팅 끝나긴 햇는데 발란스 추가 실패!!!!', error);
        res.status(500).send('INternal 배팅 끝 실패야~~ 발란스 업뎃 안돼ㅜㅜ ㅜㅜ ㅜ ');

    }


});


app.get('/api/getRealOdds' , (req, res) => {

    const query = 'SELECT * FROM Odds';
    connection.query(query, (error, results) => {

        if(error){
            console.error("프론트엔드에 odds 테이블 보내주기 오류 : " , error);
            return res.status(500).send('Internal Server Error');
        }
        res.status(200).json(results);

    });
});


app.get('/api/getTopThree',(req,res)=> {

const query = `SELECT p.title, p.member_1, p.member_2, p.brief, p.giturl, o.id_total FROM Odds o JOIN project p ON o.odds_id = p.id ORDER BY o.id_total DESC LIMIT 3`;

connection.query(query, (error,results) => {

    if(error) {
        console.error("탑 쓰리 보내기 실패! ", error);
        return res.status(500).send('Internal Server Error');
    }
    res.status(200).json(results);

});


});

function findProjectByClass(userClass, callback) {
  const query = 'SELECT * FROM project WHERE class = ?';

  connection.query(query, [userClass], function(error, results) {

      if (error) {
          console.error("분반정보 json SQL Error: ", error)
          callback(error, null);
          return;
      }
      callback(null,results);
  });
}

async function getRepositoriesInfo(repos) {
  const allRepoInfo = [];

  for (const [username, repository] of repos) {
    const repoInfo = await getRepositoryInfo(username, repository);
    allRepoInfo.push(repoInfo);
  }

  return allRepoInfo;
}


async function getRepositoryInfo(username, repository) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${username}/${repository}/readme`, {
        headers: {
          'Authorization': `token ${githubToken}`
        }
    });
    // Base64 인코딩된 README 내용을 디코딩
    const readmeContent = Buffer.from(response.data.content, 'base64').toString('utf8');
    return readmeContent;
    
  } catch (error) {
    console.error(error);
  }
}

    // 1주차 1분반 

    // 1주차 2분반 

    const week1Class2 = [
   
   ['lha0', 'madweek1'],
   ['madcamp12','madcamp-week1'],
   ['albertruaz','MadEater'],
   ['siesdart','madcamp-week1'],
   ['jooyoung9939','kjy_nsh'],
   ['naco0406','tab3'],
   ['najiyeon','3M_Mad_Memoir_Mix'],
   ['ParkGangtae','madweek1'],
   ['cypsyco','MadDiary'],
   ['systil3','week1_final'],
   ['kimh2023','madcamp-proj1'],

    ];

   // 1주차 3분반 

  // 2주차 2분반

  const week2Class2 = [
  ['systil3','MATE---from-madcamp-week-2'],
  ['cypsyco','WashHub'],
  ['Here-O','back'],
  ['jooyoung9939','kjy_peb'],
  ['seoyuncho','Watermelon'],
  ['sanananan3','madweek2'],
  ['sunnygeem','madcamp_week2'],
  ['naco0406','traveler'],
  ['hello0821','lhy_nsh'],

  ];

  let transformedReadmes = {

    week1: {
        class2: [],
    },
        
    week2: {
        class2: [],
    }

    
  };


async function processWeekClass (week, classNumber,repos) {

    const repoInfo = await getRepositoriesInfo(repos);
    transformedReadmes[week][classNumber] = repoInfo;

}

// JSON 필요할때만 하기!!


// async function processAllClasses() {
//   await Promise.all([
//     processWeekClass('week1', 'class2', week1Class2),
//     processWeekClass('week2', 'class2', week2Class2),
//   ]);

//   fs.writeFile('readmes.json', JSON.stringify(transformedReadmes, null, 2), (err) => {
//     if (err) {
//       console.error('File write failed:', err);
//       return;
//     }
//     console.log('File has been saved');
//   });
// }

// async function processWeekClass(week, classNumber, repos) {
//   const repoInfo = await getRepositoriesInfo(repos);
//   transformedReadmes[week][classNumber] = repoInfo;
// }

// // Call the async function
// processAllClasses();


const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});