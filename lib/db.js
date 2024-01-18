
const mysql = require ('mysql2');
const connection = mysql.createConnection({
    host: '13.125.245.84',
    user:'jjy8301004',
    password: 'sanaya0813!!',
    database: 'madweek3',
    port: 3306
});

connection.connect();

module.exports = db;
