# Members Only

Members Only is a community web application to add messages to a message board that is 'members only.'
Members can see who wrote the message, but those not part of the group are unable to see who wrote the message.

- [The app](https://members---only.herokuapp.com/) was created using Node.js, Express, and SQL (utilizing a POSTGRES database, originally a MONGODB database).
- It utilizes [Passport.js](https://passportjs.org/) session authentication using a username and password combination.
- Template rendering was done using Pug.
- Passwords were stored after hashing them with bcryptjs.

## Installation

Use [node and node package manager](https://nodejs.org/en/) in order to install prerequisites and run the server.

```bash
npm install
npm run serverstart
```

## Usage

To run this server, you will need to have a postgres server and be able to create a .env file.
Inside the .env file, you will need to include a connection string (named CONNECTIONSTRING) to your postgres server as well as a secret string (named SECRET) for and a secret uuid for your website (named SECRETUUID).
