if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}


const { TextServiceClient } = require("@google-ai/generativelanguage").v1beta2;
const { GoogleAuth } = require("google-auth-library");
const MODEL_NAME = "models/text-bison-001";
const API_KEY = process.env.GEMINI_API_KEY

const client = new TextServiceClient({
  authClient: new GoogleAuth().fromAPIKey(API_KEY),
});

const express=require('express')
const app=express()
const ejsMate=require("ejs-mate")
const path=require("path")
const bcrypt=require("bcrypt")
const session=require('express-session')
const notifier = require('node-notifier');
var mysql = require('mysql');
const bodyParser = require('body-parser');


app.use(bodyParser.json());


var con = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password:  process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
  //var sql = "create table NDRF( NDRF_ID NUMBER(3) primary key, contact NUMBER(10), location VARCHAR2(30), equipment VARCHAR2(50))";
  // var sql="SELECT agencies.agency_name, AgencyResources.* FROM AgencyResources JOIN agencies ON AgencyResources.AgencyID = agencies.agency_id";
  // con.query(sql, function (err, result) {
  //   if (err) throw err;
  //   console.log(result);
  //   console.log(result[0].agency_name);
  // });
  
});


const sessionConfig = {
  secret: 'thisshouldbeabettersecret!',
  resave: false,
  saveUninitialized: true,
  cookie: {
      httpOnly: true,
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      maxAge: 1000 * 60 * 60 * 24 * 7
  }
}
app.use(session(sessionConfig))

app.use(express.static(path.join(__dirname,'public')));
// app.use(express.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
//app.use(methodOverride('_method'));
app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.get("/resources",(req,res)=>{
  var sql="SELECT agencies.agency_name, AgencyResources.* FROM AgencyResources JOIN agencies ON AgencyResources.AgencyID = agencies.agency_id";
  con.query(sql, function (err, result) {
    if (err) throw err;
    console.log(result);
   var agencies=result;
   res.render("admin/resources",{agencies});
  });
    //res.render("admin/dashboard")
})
app.get("/",async(req,res)=>{
  res.render("visitor/home");

})
app.get("/home",(req,res)=>{
    res.render("visitor/home")
})


//admin routes


app.get("/admin/agencies",(req,res)=>{
  var sql="select * from agencies";
  con.query(sql, function (err, result) {
    if (err) throw err;
   var agencies=result;
   res.render("admin/agencies",{agencies});
  });
})
app.get("/admin/addresources",(req,res)=>{
  var sql="select agency_name from agencies where agency_id=?";
  con.query(sql,[req.session.agency_id], function (err, result) {
    if (err) throw err;
   var agency=result[0].agency_name;
   res.render("admin/addresources",{agency});
  });
  
})

app.get("/admin/myresources",(req,res)=>{
  var sql="select * from agencyresources where agencyid=?";
  con.query(sql,[req.session.agency_id], function (err, result) {
    if (err) throw err;
   var resources=result
   res.render("admin/myresources",{resources});
  });
})

app.post("/admin/addresources",(req,res)=>{
  const {agencyname,itemName,resdesc,quantity,status}=req.body;
//console.log(status);
  con.query('SELECT * FROM AgencyResources WHERE AgencyID = ? AND ResourceType = ? AND AvailabilityStatus = ?', [req.session.agency_id, itemName, status], function(err, result) {
    if (err) {
      throw err;
    }
    if (result.length) {
      // The resource is already present with an AvailabilityStatus of 'yes'.
      // Update the Quantity column of the matching row.
      con.query('UPDATE AgencyResources SET Quantity = Quantity + ? WHERE AgencyID = ? AND ResourceType = ? AND AvailabilityStatus = ?', [quantity, req.session.agency_id, itemName, status], function(err, result) {
        if (err) {
          // Handle error.
        }
        console.log("updated")
        // The Quantity column of the matching row has been updated.
      });
    } else {
      // The resource is not present or its AvailabilityStatus is not 'yes'.
      // You can insert the new resource here.
      con.query('INSERT INTO AgencyResources (AgencyID, ResourceType, ResourceDescription, Quantity, AvailabilityStatus) VALUES (?, ?, ?, ?, ?)', [req.session.agency_id, itemName, resdesc, quantity, status], function(err, result) {
        if (err) {
        throw err;
        }
        console.log("inserted");
        res.redirect("/admin/myresources");
      });
    }
    
  });
})


//gemini ai prompt agency classification 

app.post('/classify-incident', async (req, res) => {
  const incidentText = req.body.incident;
  console.log(req.body);
  const prompt = `You are a helpful assistant that classifies incidents into appropriate emergency response departments among Fire Department, Police Department, Search and Rescue, Disaster Response Force, Emergency Medical Services(EMS).give me full forms not shortcuts. based on the given text. Give me the answer for: ${incidentText}`;

  try {
    const result = await client.generateText({
      model: MODEL_NAME,
      prompt: {
        text: prompt,
      },
    });
    
    console.log(result);
    res.json(result[0].candidates[0].output);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


//user incident reporting routes

app.get("/reportincident",(req,res)=>{
  res.render("visitor/incident");
})
app.post("/reportincident",(req,res)=>{
  const {disaster,department,description,username,phone,address,latitude,longitude,datetime}=req.body;
  
const sql1 = 'INSERT INTO Incidents (IncidentTitle,IncidentType,IncidentDescription,Incidentaddress, IncidentDate, IncidentStatus, person_name, phone, location) VALUES (?,?, ?, ?, ?, ?, ?,?, POINT(?, ?))';

con.query(sql1, [disaster,department, description, address, datetime,"active",username, phone, longitude, latitude], function(err, result) {
    if (err) throw err;
    if (result.affectedRows) {
     console.log(result);

        var sql4="SELECT MAX(incidentid) as id FROM incidents";
      let count;
      con.query(sql4, function (err, result) {
        if (err) throw err;
        count=result[0].id;
            const sql3="UPDATE Incidents SET allotedAgencyID = ( SELECT agencies.agency_id FROM agencies WHERE ST_Distance_Sphere(Incidents.location, agencies.location, 500000) AND Incidents.IncidentType = agencies.agency_type ORDER BY ST_Distance_Sphere(Incidents.location, agencies.location) ASC LIMIT 1 ) WHERE IncidentID = ?";
            con.query(sql3,[count], function (err, result) {
              if (err) throw err;
              if(result.affectedRows){
              var sql5="SELECT a.agency_name FROM Incidents i JOIN agencies a ON i.allotedAgencyId = a.agency_id WHERE i.IncidentID = ?";
              
              con.query(sql5,[count], function (err, result) {
                if (err) throw err;
                notifier.notify(`your incident have been alloted to ${result[0].agency_name}\nthey will reach out to you shortly`)
              res.redirect("/");
              })
            }else{
              notifier.notify("there are no agencies near to you to rescue")
            }
            })
          });
    } else {
      return res.status(400).json({error: "something went wrong"});
    }
  });
})

app.get("/admin/incidents",(req,res)=>{
  var sql4="SELECT * FROM incidents where incidents.allotedagencyid=?";
  
  con.query(sql4,[req.session.agency_id], function (err, result) {
    if (err) throw err;
    console.log(result);
    res.render("admin/incidents",{result})
  })
})

app.get("/admin/incidents/:id",(req,res)=>{
  const {id}=req.params;
  var sql4="SELECT * FROM incidents where incidents.IncidentID=?";
  
  con.query(sql4,[id], function (err, result) {
    if (err) throw err;
    console.log(result);
    res.render("admin/viewincident",{result})
  })
})


app.post("/admin/:id/incident",(req,res)=>{
  const {id}=req.params;
  const {status}=req.body;
  var sql4="UPDATE Incidents SET IncidentStatus =? WHERE IncidentID = ?";
  
  con.query(sql4,[status,id], function (err, result) {
    if (err) throw err;
    console.log(result);
    if(status=="verified"){
    var sql5="INSERT INTO IncidentRescueAllocation (IncidentID, RescueTeamID,allocationstatus) VALUES (?, (SELECT TeamID FROM RescueTeam WHERE AgencyID = (SELECT allotedAgencyId FROM Incidents WHERE IncidentId = ?) ORDER BY RAND() LIMIT 1),?)";
  
    con.query(sql5,[id,id,'Allocated'], function (err, result) {
      if (err) throw err;
      console.log(result);
      var sql6="SELECT RescueTeam.TeamName, Incidents.IncidentTitle FROM IncidentRescueAllocation JOIN RescueTeam ON IncidentRescueAllocation.RescueTeamID = RescueTeam.TeamID JOIN Incidents ON IncidentRescueAllocation.IncidentID = Incidents.IncidentID WHERE IncidentRescueAllocation.IncidentID = ?";
  
      con.query(sql6,[id], function (err, result) {
        if (err) throw err;
        console.log(result);
        
          notifier.notify(`${result[0].TeamName} has been alloted to rescue incident ${result[0].IncidentTitle}`)
        
      res.redirect("/admin/incidents");
      })
    })
  }else{
    res.redirect("/admin/dashboard");
  }
  })
})


app.get("/admin/request",(req,res)=>{
  res.render("admin/request");
})
app.post("/admin/request",(req,res)=>{

  const {title,description,quantity}=req.body;
  
  console.log(req.body);
const sql1="SELECT ST_X(location) AS latitude,ST_Y(location) AS longitude FROM agencies where agency_id=?";
con.query(sql1,[req.session.agency_id], function (err, result) {
  if (err) throw err;
  const longitude=Number(result[0].longitude);
  const latitude=Number(result[0].latitude);
  const sql="SELECT * FROM (SELECT agencies.*,ST_Distance_Sphere(agencies.location, ST_GeomFromText('POINT(? ?)')) AS distance FROM agencies INNER JOIN AgencyResources ON agencies.agency_id = AgencyResources.AgencyID WHERE ST_Distance_Sphere(agencies.location, ST_GeomFromText('POINT(? ?)')) <= 100 * 1000 AND AgencyResources.ResourceType =? AND AgencyResources.AvailabilityStatus = 'available') AS nearest_agencies ORDER BY distance ASC";
  con.query(sql,[78.4867,17.3850,78.4867,17.3850,title], function (err, result) {
    if (err) throw err;
   console.log(result);
   res.render("admin/result",{result})
  });
})
})

app.get("/admin/request/:id/indirect",(req,res)=>{
  const {id}=req.params;
  const sql1="SELECT ResourceType FROM agencyresources where agencyid=?";
con.query(sql1,[id], function (err, result) {
  if (err) throw err;
  const reslt=result;
  console.log(result);
  console.log(reslt);
  res.render("admin/sendreq",{id,reslt});
})
})

app.post("/admin/request/:id/indirect",(req,res)=>{
  const {id}=req.params;
  const {restype,quantity,description,priority}=req.body;
  const sql1="INSERT INTO ResourceRequest (RequesterID, targetagencyid, ResourceType, Quantity, RequestDate, RequestStatus, PriorityLevel, RequestDescription) VALUES (?, ?, ?, ?, NOW(),?,?, ?)";
con.query(sql1,[req.session.agency_id,id,restype,quantity,'pending',priority,description], function (err, result) {
  if (err) throw err;
  console.log(result);
  res.redirect("/admin/requests")
})

})
app.get("/admin/pendingrequests",(req,res)=>{
  const sql1="SELECT rr.RequestID ,rr.ResourceType,rr.Quantity,rr.RequestDate,rr.RequestStatus,rr.PriorityLevel,rr.RequestDescription,r.agency_name AS RequestedAgencyName,a.agency_name AS TargetAgencyName FROM ResourceRequest rr JOIN agencies r ON rr.RequesterID = r.agency_id JOIN agencies a ON rr.targetagencyid = a.agency_id WHERE rr.targetagencyid = ? ORDER BY rr.RequestDate DESC";
  con.query(sql1,[req.session.agency_id], function (err, result) {
    if (err) throw err;
    console.log(result);
  res.render("admin/showreq",{result});

  })

})

app.post("/admin/:id/pendingrequest",(req,res)=>{
  const {status,responsedesc}=req.body;
  const {id}=req.params;
  const sql1="UPDATE ResourceRequest SET RequestStatus =?, ResponseDescription =? WHERE RequestID =?";
  con.query(sql1,[status,responsedesc,id], function (err, result) {
    if (err) throw err;
    console.log(result);
    res.redirect("/admin/dashboard")
  })
})




app.get("/admin/requests",(req,res)=>{
  const sql1="SELECT rr.RequestID,rr.ResourceType,rr.Quantity,rr.RequestDate,rr.RequestStatus,rr.PriorityLevel,rr.RequestDescription,a.agency_name AS TargetAgencyName FROM ResourceRequest rr JOIN agencies a ON rr.targetagencyid = a.agency_id WHERE rr.RequesterID = ? ORDER BY rr.RequestDate DESC";
con.query(sql1,[req.session.agency_id], function (err, result) {
  if (err) throw err;
  console.log(result);
  res.render("admin/req",{result});
})
})

app.get("/admin/myrequests/:id",(req,res)=>{
  const sql1="SELECT rr.ResponseDescription,rr.RequestID,rr.ResourceType,rr.Quantity,rr.RequestDate,rr.RequestStatus,rr.PriorityLevel,rr.RequestDescription,a.agency_name AS TargetAgencyName FROM ResourceRequest rr JOIN agencies a ON rr.targetagencyid = a.agency_id WHERE rr.RequestID = ?";
  con.query(sql1,[req.params.id], function (err, result) {
    if (err) throw err;
    console.log(result);
    const r=result[0];
    res.render("admin/seeresponse",{r});
  })
})

app.get("/admin/rescueteams",(req,res)=>{
  const sql1="SELECT * FROM RescueTeam rt JOIN TeamMember tm WHERE rt.AgencyID = 1 and rt.teamid=tm.teamid and tm.role='leader';";
  con.query(sql1,[req.session.agency_id], function (err, result) {
    if (err) throw err;
    console.log(result);
    res.render("admin/rescueteams",{result})
  })
  
})



//login and registration routes


app.get("/login",(req,res)=>{
  res.render("visitor/login");
})



app.get("/agencyRegistration",(req,res)=>{
  res.render("agency/registration");
})
app.post("/agencyRegistration",async(req,res)=>{
  const {agencyname,agencytype,agencydesc,username,email,password,phone,address,latitude,longitude}=req.body;
  var sql="select * from agencies where agency_name= ? ";
  con.query(sql,[email], function (err, result) {
    if (err) throw err;
    if(!result)   return res.status(400).json({error: "agency with this name exists already"});
  });
  var sql2="select * from agencies where contact_email= ? ";
  con.query(sql2,[email], function (err, result) {
    if (err) throw err;
    if(!result)   return res.status(400).json({error: "agency with this email exists already"});
  });
  var sql3="select * from agencies where contact_phone= ? ";
  con.query(sql3,[phone], function (err, result) {
    if (err) throw err;
    if(!result)   return res.status(400).json({error: "agency with this mobile number exists already"});
  });
  var sql4="select COUNT(*) as num from agencies";
  let count;
  con.query(sql4, function (err, result) {
    if (err) throw err;
    count=result[0].num;
  });
  const secPass= await bcrypt.hash(password,12);
 
const sql1 = 'INSERT INTO agencies (agency_id,agency_name,agency_type, agency_description, contact_person, contact_email, contact_phone, address, location) VALUES (?,?, ?, ?, ?, ?, ?, ?, POINT(?, ?))';

con.query(sql1, [count+1,agencyname,agencytype, agencydesc, username, email, phone, address, longitude, latitude], function(err, result) {
    if (err) throw err;
    if (result.affectedRows) {
      const insql='INSERT INTO useraccounts (AgencyID,Username,password,UserRole) VALUES(?,?,?,?)';
      con.query(insql,[count+1,username,secPass,'admin'], function (err, result) {
        if (err) throw err;
        res.redirect("/login");
      });
      
    } else {
      return res.status(400).json({error: "something went wrong"});
    }
  });
  
})

app.post("/login",async(req,res)=>{
  const {username,password}=req.body;
  var sql2="select userid,agencyid,username,password from useraccounts where username= ? ";
  
con.query(sql2,[username], function (err, result) {
    if (err) throw err;
   
    if(!result)   return res.status(400).json({error: "user not found.please register and login"});
    else{
      const valid= bcrypt.compareSync(password,result[0].password);
      if(valid){
        req.session.user_id=result[0].userid;
        req.session.agency_id=result[0].agencyid;
       res.redirect("/admin/dashboard");
   }else{
    return res.status(400).json({error:"incorrect username or password"})};
    }
  });
})

app.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        res.status(400).send('Unable to log out')
      } else {
        res.redirect('/home');
      }
    });
  } else {
    res.end()
  }
})


app.get("/admin/dashboard",(req,res)=>{
  res.render("admin/dashboard");
})

app.listen(3000,()=>{
    console.log("coonnected succesfully");
})

