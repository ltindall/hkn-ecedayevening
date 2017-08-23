var express = require('express');
var app = express();
var session = require('express-session'); 
var bodyParser = require('body-parser');

var GoogleSpreadsheet = require('google-spreadsheet');
var async = require('async');


// Get spreadsheet
// spreadsheet key is the long id in the sheets URL
var doc = new GoogleSpreadsheet('1XOCHHWn5K1l7LxRFx8kve2Gw6Bw6-hIWXcXE-raPP_8');
var sheet;

var itemSheet; 

var itemRows; 
var urlencodedParser = bodyParser.urlencoded({ extended: false })


/*
 * Setup the webserver. 
 * Format routing. 
 */
app.use(express.static('public'));
app.use(session({secret: 'hknsecret'})); 

/* 
 * Get / 
 */
app.get('/', function (req, res) {
    res.sendFile( __dirname + "/" + "index.html" ); 
    console.log("loaded index.html"); 
}); 


/*
 * Connect to google doc and get sheet. 
 */
async.series([
  function setAuth(step) {
    // see notes below for authentication instructions!
    var creds = require('./google-generated-creds.json');

    doc.useServiceAccountAuth(creds, step);
  },
  function getInfoAndWorksheets(step) {
    doc.getInfo(function(err, info) {
      if(err) {
        console.log(err); 
      } 
      else { 
        console.log('Loaded doc: '+info.title+' by '+info.author.email);
        sheet = info.worksheets[0];
        console.log('sheet 1: '+sheet.title+' '+sheet.rowCount+'x'+sheet.colCount);
        // DEBUG: print all emails 
        /*.
        sheet.getRows({
          offset: 1,
        //  limit: 20,
        //  orderby: 'col2'
        }, function( err, rows ){
          console.log('err: '+err);
          console.log(rows); 
          console.log(rows.length); 
          for (var i = 0; i < rows.length; i++){ 
            console.log(i+ ' '+rows[i]['email']); 
          } 
        }); 
        */

      } 
      step();
    });
  }, 
]); 

app.post('/process_signin', urlencodedParser, function (req, res) {
  console.log("process signin starting ..."); 
  // Prepare output in JSON format
  response = {
    email:req.body.email 
  };

  async.series([
    function trySignIn(callback) {
                                          
      sheet.getRows({
        offset: 1,
      }, function( err, rows ){

        var err1 = null; 
        var foundEmail = false; 
        var name = ""; 

        // loop over all users 
        for (var i=0; i < rows.length; i++){
           

          // if found matching user 
          if( response.email.toString().trim().toLowerCase() === rows[i].email.toString().trim().toLowerCase()) { 

            console.log("found matching email for "+name); 


            foundEmail = true; 
            name += rows[i]['firstname'] + " " + rows[i]['lastname']; 
            rows[i]['signin'] = Date().toString(); 
            rows[i].save(); 

            break; 
          } 
        } 
        if (!foundEmail) { 

          err1 = "Error: No registration found."; 
        } 

        callback(err1, name); 
      });
    } 
 
  ], 
  function(err, results) { 

    signinMessage = ""; 
    var name = results[0];  

    if(err) { 
      signinMessage = '<div class="alert alert-danger" roles="alert" id="signinMessage">Error: No registratoin found.</div>'; 
    } 
    else { 
      signinMessage = '<div class="alert alert-success" roles="alert" id="signinMessage">Success!<br>' + name + ' has been signed in.</div>'; 
    } 
    
    res.send(signinMessage); 

  }); 
  //res.end(JSON.stringify(response));
}); 

app.post('/process_registration', urlencodedParser, function (req, res) {
  console.log("process registration starting ..."); 

  // Prepare output in JSON format
  response = {
    userid:req.body.inputId, 
    username:req.body.inputName, 
    balance:req.body.inputBalance
  };

  /*
  req.session.user_id = response.userid.toString().trim(); 
  req.session.username = response.username.toString().trim(); 
  req.session.balance = response.balance.toString().trim(); 
  */
 
  async.series([

    function checkUser(callback) { 
      sheet.getRows({
        offset: 1,
      }, function( err, rows ){
        var err1 = null; 
        if (err) { 
          err1 = err; 
        } 
        else { 
          for (var i=0; i < rows.length; i++){
            if( response.userid.toString().trim() === rows[i].userid) { 
              err1 = "Error: Duplicate user id." 
            } 
          } 
        } 
        callback(err1, "success");  
      });

    }, 
    function tryRegister(callback) {
                                          
      sheet.addRow({
          'userid': response.userid.toString().trim(), 
          'username': response.username.toString().trim(),  
          'debt-credit': response.balance.toString().trim()
      }, function(err){

        callback(err, "success"); 
          
      });
    }
 
  ], 
  function(err, results) { 
    if (err) { 
      req.session.registerSuccess = false; 
      req.session.registerMessage = `<div class="alert alert-danger" role="alert">Problem creating new user.<br> `+err+`</div>`
      res.redirect("/register"); 
    } 
    else { 
      req.session.loginSuccess = false; 
      req.session.registerSuccess = true; 
      req.session.loginMessage = `<div class="alert alert-success" role="alert"><strong>Success!</strong> New user created. Please login.</div>`

      res.redirect("/"); 
    } 
    
  }); 
  //res.end(JSON.stringify(response));
}); 

var server = app.listen(1118, function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("Example app listening at http://%s:%s", host, port)

})
