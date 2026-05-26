terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.region

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server" "main" {
  count                  = var.db_engine == "postgres" ? 1 : 0
  name                   = var.server_identifier
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = var.postgres_version
  administrator_login    = var.db_username
  administrator_password = var.db_password
  sku_name               = var.sku_name
  storage_mb             = var.storage_mb
  zone                   = var.zone

  public_network_access_enabled = true

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  count            = var.db_engine == "postgres" ? 1 : 0
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main[0].id
  start_ip_address = var.allowed_ip_start
  end_ip_address   = var.allowed_ip_end
}

resource "azurerm_postgresql_flexible_server_database" "initial" {
  count     = var.db_engine == "postgres" && var.create_db ? 1 : 0
  name      = var.initial_db_name
  server_id = azurerm_postgresql_flexible_server.main[0].id
  collation = "en_US.utf8"
  charset   = "UTF8"
}

resource "azurerm_mssql_server" "main" {
  count                        = var.db_engine == "sqlserver" ? 1 : 0
  name                         = var.server_identifier
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = var.db_username
  administrator_login_password = var.db_password
  minimum_tls_version          = "1.2"

  tags = var.tags
}

resource "azurerm_mssql_firewall_rule" "azure_services" {
  count            = var.db_engine == "sqlserver" ? 1 : 0
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.main[0].id
  start_ip_address = var.allowed_ip_start
  end_ip_address   = var.allowed_ip_end
}

resource "azurerm_mssql_database" "initial" {
  count     = var.db_engine == "sqlserver" && var.create_db ? 1 : 0
  name      = var.initial_db_name
  server_id = azurerm_mssql_server.main[0].id
  sku_name  = var.mssql_database_sku
}
