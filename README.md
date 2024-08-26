# Rescue Connect

## Overview

Rescue Connect is a web application that facilitates collaboration among different rescue agencies during disasters, aiming to enhance coordination and response efficiency.

## Features

- *Agency Authentication*: Secure login and registration for rescue agencies and their admin.
- *Incident Classification*: Integrated Gemini AI API for easier classification of disaster types.
- *Incident Management*: Automated incident allocation to the nearest agency.
- *Resource Tracking*: Add, update and track availability essential resources such as medical supplies, food, and shelter.
- *Geolocation Search*: Locate nearby agencies using radius-based search functionality for a particular resource.


## Technologies Used

- *Frontend*: HTML, CSS, JavaScript, EJS, Bootstrap
- *Backend*: Node.js, Express.js, Gemini API
- *Database*: MySql
- *Authentication*: Bcrypt

## Installation

To set up the project locally, follow these steps:

1. *Clone the repository*

2. *Create .env file in the directory and set the following variables*:
   bash
   GEMINI_API_KEY     #create a Google API key
   MYSQL_HOST         #Enter the Host address
   MYSQL_USER         #enter username of the user
   MYSQL_PASS         #Enter passweord the user
   MYSQL_DB           #enter name of the database
   
4. *Install dependencies in same directory*:
   bash
   npm install
   
5. *run this command*:
   bash
   node index.js
   
7. *open browser and enter https:://localhost:3000/*
