# Project Name - Custom Kerberos Protocol Implementation with NestJS

![Kerberos Logo](https://miro.medium.com/v2/resize:fit:700/0*Qeh4qhAIiY1zxjCR.gif)

## Table of Contents

- [Description](#description)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)

## Description

This project is a custom implementation of the Kerberos protocol using NestJS, a powerful Node.js framework. The implementation consists of two servers, acting as Key Distribution Centers (KDC), and a registration server. The KDC servers are responsible for issuing and validating tickets, while the registration server handles user registration and authentication.

Kerberos is a widely-used authentication protocol that provides secure authentication for users and services in a networked environment. This project aims to demonstrate the core concepts of the Kerberos protocol and how it can be implemented from scratch using NestJS.

## Features

- Custom Kerberos protocol implementation
- KDC server for ticket issuance and validation
- Registration server for user authentication and registration
- PostgreSQL database for storing user credentials
- Redis caching for efficient ticket management

## Prerequisites

Before running this project, ensure you have the following installed:

- Node.js (>=12.x)
- npm (>=6.x)
- docker-compose

## Installation

1. Clone the repository:

```bash
git clone https://github.com/MedNoun/Nesty-kerberos.git
cd Nesty-kerberos
```
2. Installation

```bash
cd kdc && npm install && cd service && npm install
```
3. Configuration

The project requires some configuration settings to run correctly. Create a .env file in the root directory of the project and set the following environment variables:
```
SERVICE_NAME=portal

#Redis Config

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=eYVX7EwVmmxKPCDmwMtyKVge8oLd2t81

#Postgres Config

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=pass123
```
4.Run Project
```bash
docker-compose -up && cd kdc && npm start && cd ../service && npm start
```

