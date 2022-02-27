import './App.css';
import { useRef, useEffect } from 'react'
import '@polymer/paper-input/paper-input.js'
import '@polymer/paper-button/paper-button.js'
import '@polymer/paper-dialog/paper-dialog.js'
import '@polymer/paper-dropdown-menu/paper-dropdown-menu-light.js'
import '@polymer/paper-listbox/paper-listbox.js'
import '@polymer/paper-item/paper-item.js'
import '@polymer/iron-icons/iron-icons'
import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl from 'mapbox-gl'
import AWS from 'aws-sdk'

import catPfp from './catPfp.png'
import dogPfp from './dogPfp.png'
import otherPfp from './fishPfp.png'
import linkedin from './linkedin.png'
import github from './github.png'

var selectedPet = {};
var selectedCoords = [];
var map;
var clickMarker;
var markers = [];

function showDialog(dialog) {
  dialog.current.style.display = "block";
}
function hideDialog(dialog) {
  document.getElementById("petnameinput").value = "";
  document.getElementById("petbreedinput").value = "";
  document.getElementById("pettypeinput").selected = null;
  document.getElementById("petageinput").selected = null;
  document.getElementById("petdescriptioninput").value = "";
  document.getElementById("contactnameinput").value = "";
  document.getElementById("contactemailinput").value = "";
  document.getElementById("contactphoneinput").value = "";
  dialog.current.style.display = "none";
}

function UpdateSidebar() {
  if (selectedPet != null){
    document.getElementById("petname").innerHTML = selectedPet.PetName;
    document.getElementById("petinfo").innerHTML = selectedPet.PetType + " - " + selectedPet.PetBreed + " - " + selectedPet.PetAge;
    document.getElementById("petdescription").innerHTML = selectedPet.Description;
    document.getElementById("contactheader").innerHTML = "Contact";
    document.getElementById("contactname").innerHTML = "Name: " + selectedPet.ContactName;
    document.getElementById("contactphone").innerHTML = "Phone: " + selectedPet.ContactPhone;
    document.getElementById("contactemail").innerHTML = "Email: " + selectedPet.ContactEmail;
    switch (selectedPet.PetType) {
      case "Cat":
        document.getElementById("petpfp").src = catPfp;
        break;
      case "Dog":
        document.getElementById("petpfp").src = dogPfp;
        break;
      default:
        document.getElementById("petpfp").src = otherPfp;
    }
    markers.forEach((marker) => marker.remove());
    clickMarker.remove();
    markers = [];
    for (var i = 0; i < selectedPet.PosterCoords.length; i++) {
      const coordinates = JSON.parse(selectedPet.PosterCoords[i]);
      const marker = new mapboxgl.Marker({color: "green"}).setLngLat(coordinates).addTo(map.current);
      markers.push(marker);
    }
  }
}

function App() {
  const helpdialog = useRef();
  const reportdialog = useRef();
  const searchbar = useRef();

  mapboxgl.accessToken = 'pk.eyJ1IjoianVzdG5lc3MiLCJhIjoiY2t2dWhxODl0MDc5YTJ2dG45NWpibnV6ZyJ9.i67QsYlsF8qSLydzMGIQrg';
  const mapContainer = useRef();
  map = useRef();
  const marker = new mapboxgl.Marker({draggable: true}); // maintain only one marker
  useEffect(() => {
    if (map.current) return; // initialize map only once
    map.current = new mapboxgl.Map({
    container: mapContainer.current,
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-73.5772, 45.5048],
    zoom: 13
    });
    map.current.doubleClickZoom.disable();
    map.current.on("click", (event) => {
      selectedCoords = event.lngLat;
      marker.setLngLat(selectedCoords).setPopup(new mapboxgl.Popup().setHTML(
        `<paper-button class='big-button' onclick="document.getElementById('reportdialog').style.display = 'block'" style='border-radius:50px; margin:0'>Poster</paper-button>
        <paper-button class='big-button' onclick="document.getElementById('reportdialog').style.display = 'block'" style='border-radius:50px; margin:0'>Sighting</paper-button>`
      )).addTo(map.current).togglePopup();
    });
    clickMarker = marker;
  });

  // ***Assumes that all lost pets with the same name are the same pet. Pet name is the Partition Key.
  // TODO: Possible fix: If duplicates with mismatched type/breed/age are submitted, add "invisible" numbers to the end of Partition Key for new entry and remove before display.
  AWS.config.update({
    region: "us-east-1",
    endpoint: 'dynamodb.us-east-1.amazonaws.com',
    accessKeyId: "",
    secretAccessKey: ""
  });
  var docClient = new AWS.DynamoDB.DocumentClient();
  function queryPetName(name) {
    if (name !== ""){
      var params = {
        TableName : "Pets",
        Key: {
          "PetName": name
        }
      };
      docClient.get(params, function(err, data) {
          if (err) alert("Unable to query pet.")
          else {
            selectedPet = data.Item;
            if (data.Item == null){
              alert("No such pet was found.");
              return null;
            } 
            else{
              UpdateSidebar();
              return data.Item;
            }
          }
      });
    }
    else alert("Search query cannot be empty.");
    return null;
  }
  function submitPet(){
    const petname = document.getElementById("petnameinput").value;
    const petbreed = document.getElementById("petbreedinput").value;
    const pettype = document.getElementById("pettypeinput").value;
    const petage = document.getElementById("petageinput").value;
    const petdescription = document.getElementById("petdescriptioninput").value;
    const contactname = document.getElementById("contactnameinput").value;
    const contactemail = document.getElementById("contactemailinput").value;
    const contactphone = document.getElementById("contactphoneinput").value;
    var getParams = {
      TableName : "Pets",
      Key: {
        "PetName": petname
      }
    };
    docClient.get(getParams, function(err, data) {
        if (err) return;
        else {
          selectedPet = data.Item;
          if (data.Item == null){
            var params = {
              TableName : "Pets",
              Item: {
                "PetName": petname,
                "PetType": pettype,
                "PetBreed": petbreed,
                "PetAge": petage,
                "Description": petdescription,
                "ContactName": contactname,
                "ContactPhone": contactphone,
                "ContactEmail": contactemail,
                "PosterCoords": [JSON.stringify(selectedCoords)]
              }
            }
            docClient.put(params, function(err, data) {
              if (err) {
                  alert("Unable to add report.");
              } else {
                  hideDialog(reportdialog);
              }
            });
          } 
          else{
            var coords = JSON.stringify(selectedCoords);
            var params = {
              TableName : "Pets",
              Key:{
                "PetName": petname
              },
              UpdateExpression: "set PetType=:pt, PetBreed=:pb, PetAge=:pa, Description=:pd, ContactName=:cn, ContactPhone=:cp, ContactEmail=:ce, PosterCoords=list_append(PosterCoords, :pc)",
              ExpressionAttributeValues: {
                ":pt": pettype,
                ":pb": petbreed,
                ":pa": petage,
                ":pd": petdescription,
                ":cn": contactname,
                ":cp": contactphone,
                ":ce": contactemail,
                ":pc": [coords]
              },
              ReturnValues: "UPDATED_NEW"
            }
            docClient.update(params, function(err, data) {
              if (err) {
                  alert("Unable to update report.");
              } else {
                  hideDialog(reportdialog);
              }
            });
          }
        }
    });
  }

  return (
    <div className="App" style={{flexWrap:'wrap'}}>
      <div id="app-bkg"></div>
      <paper-dialog ref={helpdialog}>
        <br />
        <h2>About this project</h2>
        <br />
        <p>PetSpotter is a webapp project created over a weekend for the Code.Jam(XI) hackathon.</p><br />
        <p>Rather than relying on unoptimized reporting platforms (often social media groups), PetSpotter allows for the aggregation of lost pet poster and sighting data, creating visual ranges for locating lost pets.</p><br />
        <p>For public access to the code, check out the GitHub repo <a href="https://github.com/justness/PetSpotter">here</a>.</p>
        <br />
        <paper-button onClick={function(){hideDialog(helpdialog)}} style={{width:20+'px'}}><iron-icon icon="close"></iron-icon></paper-button>
      </paper-dialog>
      <paper-dialog id="reportdialog" ref={reportdialog} style={{top:0, height:'fit-content', maxHeight:90+'vh', overflow:'auto'}}>
        <form style={{width:20+'vw', display:'inline-block'}}>
          <br />
          <h2>Report new information</h2>
          <br />
          <div style={{textAlign:'start'}}>
            <paper-input id="petnameinput" class="form-input" label="Pet Name" always-float-label style={{marginTop:2+'vh'}} required></paper-input>
            <paper-input id="petbreedinput" class="form-input" label="Pet Breed" always-float-label></paper-input>
            <paper-dropdown-menu-light id="pettypeinput" label="Pet Type" always-float-label style={{width:9+'vw', display:'inline-block'}}>
              <paper-listbox slot="dropdown-content">
                <paper-item>Cat</paper-item>
                <paper-item>Dog</paper-item>
                <paper-item>Other</paper-item>
              </paper-listbox>
            </paper-dropdown-menu-light>
            <paper-dropdown-menu-light id="petageinput" label="Pet Age" always-float-label style={{width:9+'vw', display:'inline-block', marginLeft:2+'vw'}}>
              <paper-listbox slot="dropdown-content">
                <paper-item>Newborn</paper-item>
                <paper-item>Adult</paper-item>
                <paper-item>Senior</paper-item>
              </paper-listbox>
            </paper-dropdown-menu-light>
            <paper-input id="petdescriptioninput" class="form-input" label="Pet Description" always-float-label></paper-input>
            <br />
            <paper-input id="contactnameinput" class="form-input" label="Contact Name" always-float-label></paper-input>
            <paper-input id="contactemailinput" class="form-input" label="Contact Email" always-float-label style={{width:9+'vw', display:'inline-block'}}></paper-input>
            <paper-input id="contactphoneinput" class="form-input" label="Contact Phone" always-float-label style={{width:9+'vw', display:'inline-block', marginLeft:2+'vw'}}></paper-input>
          </div>
          <br />
          <paper-button onClick={function(){hideDialog(reportdialog)}} style={{width:20+'px', marginTop:2+'vh'}}><iron-icon icon="close"></iron-icon></paper-button>
          <paper-button onClick={function(){submitPet()}} style={{width:20+'px'}}><iron-icon icon="check"></iron-icon></paper-button>
        </form>
      </paper-dialog>
      <div>
        <h1 style={{display:'inline-flex', alignItems:'center', margin:2+'vh', maxWidth:100+'%'}}>
          PetSpotter <iron-icon icon="pets" style={{transform:"rotate(20deg)"}}></iron-icon>
          <div style={{marginLeft:60+'px', backgroundColor:'lightgrey', display:'inline-flex', alignItems:'center', border:'2px solid var(--outlines)', borderRadius:50+'px', height:25+'px'}}>
            <input ref={searchbar} style={{marginLeft:30+'px', fontSize:12+'px', width:1400+'px', maxWidth:40+'vw'}} autoFocus />
            <paper-button class="mini-button" onClick={function(){queryPetName(searchbar.current.value)}}><iron-icon icon="search"></iron-icon></paper-button>
          </div>
          <paper-button class="mini-button" onClick={function(){showDialog(helpdialog)}} style={{position:'fixed', right:1+'vh'}}><iron-icon icon="help-outline"></iron-icon></paper-button>
        </h1>
      </div>
      <div style={{flexBasis:100+'%', height:2+'vh'}}></div>
      <div style={{flexGrow:2, border:'1px solid var(--outlines)'}}>
        <div id="map" ref={mapContainer} style={{position:'sticky', bottom:0, left:0, height:80+'vh', width:'inherit'}}></div>
      </div>
      <div id="sidebar" style={{flexGrow:1, maxWidth:30+'vw', border:'1px solid var(--outlines)'}}>
        <div style={{padding:2+'vh'}}>
          <div style={{display:'flex', alignItems:'center'}}>
            <img id="petpfp" style={{width:120+'px', marginRight:1+'vh'}}></img>
            <div>
              <h2 id="petname"></h2>
              <p id="petinfo"></p>
            </div>
          </div>          
          <br />
          <p id="petdescription" style={{textOverflow:'ellipsis', overflowWrap:'anywhere', maxHeight:20+'vh', overflow:'hidden', textAlign:'center'}}><iron-icon icon="arrow-upward" style={{transform:'rotate(-45deg)'}}></iron-icon>&nbsp;Search up a pet's name to get started!</p>
          <br />
          <div>
            <h3 id="contactheader"></h3>
            <p id="contactname"></p>
            <p id="contactphone"></p>
            <p id="contactemail"></p>
          </div>
          <br />
          <h3 id="photoheader"></h3>
        </div>
      </div>
      <div style={{flexBasis:100+'%'}}></div>
      <div style={{position:'absolute', left:0, bottom:0}}>
        <p style={{display:'inline-flex', color:'white'}}>
          Created by justness&nbsp;
          <a href="https://www.linkedin.com/in/v-chu/" target="_blank"><img src={linkedin} style={{width:20+'px'}}></img></a>&nbsp;
          <a href="https://github.com/justness" target="_blank"><img src={github} style={{width:20+'px'}}></img></a>&nbsp;
          for Code.Jam(XI)
        </p>
      </div>
      <div id="app-footer"></div>
    </div>
  );
}

export default App;
