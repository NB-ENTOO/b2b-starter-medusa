<h1 align="center">
  <a href="http://www.amitmerchant.com/electron-markdownify"><img src="https://github.com/user-attachments/assets/38ba3a7b-e07b-4117-8187-7b171eae3769" alt="B2B Commerce Starter" width="80" height="80"></a>
  <br>
  <br>
  Medusa B2B Commerce Starter
  <br>
</h1>

<p align="center">Customizable B2B ecommerce built with <a href="https://medusajs.com/" target="_blank">Medusa 2.0</a> & Next.js Storefront</p>

<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/master/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
    
  <a href="https://discord.gg/xpCwq3Kfn8">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>

  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
  </a>
</p>

<p align="center">
  <video src="https://github.com/user-attachments/assets/833b26a5-4b52-447f-ac30-6ae02cbe8f05" controls="controls" muted="muted" playsinline="playsinline">
</video>
</p>

<br>

## Table

- [Prerequisites](#prerequisites)
- [Enhanced Development Setup](#-enhanced-development-setup)
- [Overview](#overview)
  - [Features](#features)
  - [Demo](#demo)
- [Quickstart](#quickstart)
- [Update](#update)
- [Resources](#resources)
- [Contributors](#contributors)

&nbsp;

## Prerequisites

⚠️ We have tested this repo with the below versions:

- ✅ Node 20
- ✅ Postgres 15
- ✅ Medusa 2.4
- ✅ Next.js 15
- ✅ Docker & Docker Compose (for infrastructure services)

&nbsp;

## 🚀 Enhanced Development Setup

This fork includes additional enhancements to make your MedusaJS learning journey easier with a **ready-to-deploy local development environment**:

### ✨ What's Added

- **🐳 Docker Compose Infrastructure** - Complete containerized setup for all services
- **📦 MinIO S3 Storage** - Self-hosted file storage with automatic image processing
- **🔍 MeiliSearch Integration** - Full-text search with beautiful storefront search modal
- **⚡ Redis Caching** - Event bus and workflow engine optimization
- **🛠️ Enhanced Seed Script** - Idempotent seeding with automatic image processing
- **🎯 Developer Experience** - Improved port management and development tools

### 🚀 Quick Start with Docker

```bash
# Start all infrastructure services
cd "docker compose"
docker-compose up -d

# Services will be available at:
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379  
# - MeiliSearch: localhost:7700
# - MinIO: localhost:9090 (API) / localhost:9001 (Console)
```

#### 🗂️ Data Persistence & Fresh Start

All service data is stored in the `docker compose/data/` folder:
- `data/postgres/` - Database files
- `data/redis/` - Redis persistence
- `data/meilisearch/` - Search index data
- `data/minio_data/` - File storage

**🔄 To start completely fresh:**
```bash
# Stop services
docker-compose down

# Remove all data
rm -rf data/

# Start fresh
docker-compose up -d
# Then re-run the seed script: yarn medusa db:migrate && yarn run seed
```

> **Note**: This is a **development-focused enhancement** to help newcomers get started quickly. While it includes production-ready components, additional configuration may be needed for production deployment.

&nbsp;

## Overview
For a full feature overview, please visit [the project wiki](https://github.com/medusajs/b2b-starter-medusa/wiki).

#### Core features

- **Company Management**. Customers can manage their company and invite employees.
- **Spending Limits**. Company admins can assign spending limits to its employees.
- **Bulk add-to-cart**. Customers can add multiple variants of a product to their cart at once.
- **Quote Management**. Customers & Merchants can communicate, accept or reject quotes.
- **Order Edit**. Merchants can edit orders or quotes - add/remove item, update quantity & price management and more.
- **Company Approvals**. Companies can mandate approvals from company admins before employees can finalize a cart.
- **Merchant Approvals**. Merchants can set up approval processes for orders, ensuring compliance with business rules before fulfillment.
- **Promotions**. Customers can apply manual and automatic promotions to their cart.
- **Free Shipping Nudge**. Displays a component showing progress toward free shipping.
- **Full ecommerce support**
  - Product Pages
  - Product Collections & Categories
  - Cart & Checkout
  - User Accounts
  - Order Details
- **Full Next.js 15 support**
  - App Router
  - Caching
  - Server components/actions
  - Streaming
  - Static Pre-Rendering

&nbsp;

#### Demo

#### Quote Management

<img align="right" src="https://github.com/user-attachments/assets/110c99e8-18ba-49e5-8955-84a058b597c7" alt="image" style=: />
&nbsp;

#### Company Management

<img align="right" src="https://github.com/user-attachments/assets/361702ce-d491-4509-a930-4361ab3b4126" alt="image" style=: />
&nbsp;

#### Approval Management

<img align="right" src="https://github.com/user-attachments/assets/b93b7b94-41a9-4c5f-bd6b-abf87492ed46" alt="image" style=: />
&nbsp;

#### Product Page

<img align="right" src="https://github.com/user-attachments/assets/2cd8a3ff-5999-49af-890a-4bac7b6f2f15" alt="image" style=: />
&nbsp;

#### Cart Summary

<img align="right" src="https://github.com/user-attachments/assets/095f5565-992e-4c74-acdc-a44bd905e59b" alt="image" style=: />
&nbsp;

&nbsp;

## Quickstart

#### Setup Infrastructure (Enhanced Version)

```bash
# Clone the repository
git clone https://github.com/NB-ENTOO/b2b-starter-medusa.git

# Start infrastructure services with Docker
cd "docker compose"
docker-compose up -d

# Wait for services to be ready (about 30 seconds)
# Check service status: docker-compose ps
```

#### Setup Medusa project

```bash
## Setup Backend

# Go to the folder
cd ../backend

# Clone .env.template
cp .env.template .env

# Install dependencies
yarn install

# Install dependencies, setup database & seed data
# Note: The enhanced seed script will automatically:
# - Set up MinIO file storage with processed product images
# - Configure MeiliSearch with product indexing
# - Create sample products with proper file storage
yarn install && yarn medusa db:create && yarn medusa db:migrate && yarn run seed && yarn medusa user -e admin@test.com -p supersecret -i admin

# Start Medusa project - backend & admin
yarn dev

## Setup Storefront

# Go to folder
cd ../storefront

# Clone .env.template
cp .env.template .env

# Install dependencies
yarn install
```

#### Setup publishable key

- ✅ Visit [Admin: Publishable Key](http://localhost:9000/app/settings/publishable-api-keys)
  - <b>Credentials</b>:
    - <b>email</b>: `admin@test.com`
    - <b>password</b>: `supersecret`
- ✅ Copy token key of "Webshop"
- ✅ Open file - `storefront/.env`
- ✅ Add token to this var - `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`

```
# Start Medusa storefront
yarn dev
```

Visit the following links to see the Medusa storefront & admin

- [Medusa Admin](http://localhost:9000/app)
- [Medusa Storefront](http://localhost:8000)

#### 🎉 Enhanced Features Available

After setup, you'll have access to these additional features:

- **🔍 Search Functionality** - Try the search bar in the storefront (⌘K or Ctrl+K)
- **📦 File Storage** - Product images are served from your local MinIO instance
- **📊 Search Analytics** - MeiliSearch dashboard at [http://localhost:7700](http://localhost:7700)
- **🗄️ File Management** - MinIO console at [http://localhost:9001](http://localhost:9001) (admin/password: `medusaminio`)

&nbsp;

# Update

Some general guidelines for when you're updating this Starter to a newer version.

## Update packages

Run `yarn install` in both projects to update you're packages to the latest versions.

## Run migrations

To reflect any changes made to data models, make sure to run `npx medusa db:migrate` in the backend project.

> Note: are you updating from a version of this Starter that didn't have the Approval module yet? Run `npx medusa exec src/scripts/create-approval-settings.ts` in the backend project to add approval settings to all existing companies.

# Resources

#### Learn more about Medusa

- [Website](https://www.medusajs.com/)
- [GitHub](https://github.com/medusajs)
- [2.0 Documentation](https://docs.medusajs.com/v2)

#### Learn more about Next.js

- [Website](https://nextjs.org/)
- [GitHub](https://github.com/vercel/next.js)
- [Documentation](https://nextjs.org/docs)

&nbsp;

## Contributors

<a href = "https://github.com/medusajs/b2b-starter-medusa/graphs/contributors">
  <img src = "https://contrib.rocks/image?repo=medusajs/b2b-starter-medusa"/>
</a>
