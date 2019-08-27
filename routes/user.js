//Contains all user related routes
const express = require('express')
const mysql = require('mysql')
const router = express.Router()

const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: 'softdrink9',
    database: 'testDatabase'
})

function getConnection() {
    return pool
}

router.post("/user/create", (req, res) => {
    console.log("Trying To create a new user")

    const firstName = req.body.createFirstName
    const lastName = req.body.createLastName

    const queryString = "INSERT INTO users (first_name, last_name) VALUES (?,?)"
    getConnection().query(queryString, [firstName, lastName], (err, results, fields) => {
        if (err) {
            console.log("Failed to insert with error: " + err)
            res.sendStatus(500)
            return
        }

        console.log("Inserted new user with ID: " + results.insertId);
        res.end()
    })
})

router.get("/user/:id", (req, res) => {
    console.log("Fetching user with ID: " + req.params.id)
    const Connection = getConnection()
    
    const userID = req.params.id
    const queryString = "SELECT * FROM users WHERE id = ?"
    Connection.query(queryString, [userID], (err, rows, fields) => {
        if (err) {
            console.log("Failed to connect to users with error: " + err)
            res.sendStatus(500)
            res.end()
            return
        }
        console.log("Fetched Users succesfully... I think")

        const users = rows.map((row) => {
            return {firstName: row.first_name, lastName: row.last_name}
        })
        res.json(users)
    })
})

router.get("/users", (req,res) => {
    const Connection = getConnection()
    const userID = req.params.id
    const queryString = "SELECT * FROM users"
    Connection.query(queryString, (err, rows, fields) => {
        if (err) {
            console.log("Failed to connect to users with error: " + err)
            res.sendStatus(500)
            res.end()
            return
        }
        console.log("Fetched Users succesfully")
        res.json(rows)
    })
})


module.exports = router