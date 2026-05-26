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

resource "azurerm_container_app_environment" "main" {
  name                = var.container_app_environment_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  tags = var.tags
}

resource "azurerm_container_app" "main" {
  name                         = var.container_app_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    container {
      name   = var.container_name
      image  = var.image
      cpu    = var.cpu
      memory = "${var.memory}Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = var.port

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = var.tags
}
