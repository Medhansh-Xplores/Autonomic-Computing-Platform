# acp-core-ui
Autonomic Computing Platform (ACP) - Core User Interface

[![Build Status](https://github.com/AutonomicSolutions/acp-core-ui/actions/workflows/maven-aws.yml/badge.svg?branch=main)](https://github.com/AutonomicSolutions/acp-core-ui/actions/workflows/maven-aws.yml)

## Core Technology Stack

![Angular](https://img.shields.io/badge/angular-%23DD0031.svg?style=for-the-badge&logo=angular&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)

| Technology | Description | Use |
| -- | -- | -- |
| [Angular](https://angular.io/) | User Interface Framework | Runtime |
| [NodeJS](https://nodejs.org/) | JavaScript Runtime | Build |

## Building from Source

ACP Core UI uses a [Apache Maven](https://maven.apache.org/)-based build system.

In the instructions below, `mvnw` is invoked from the root of the source tree and serves as
a cross-platform, self-contained bootstrap mechanism for the build.


### Prerequisites
[Git](https://help.github.com/set-up-git-redirect), [JDK 11](https://www.oracle.com/technetwork/java/javase/downloads) and [Node.js](https://nodejs.org/) v18+.

Be sure that your `JAVA_HOME` environment variable points to the `jdk-11` folder extracted from the JDK download.

### Check out sources

```
git clone https://github.com/AutonomicSolutions/acp-core-ui.git
```
### Compile and run locally

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
