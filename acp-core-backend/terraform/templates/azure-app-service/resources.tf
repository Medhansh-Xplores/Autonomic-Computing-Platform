resource "azurerm_container_registry" "main" {
  name                = var.acr_name
  resource_group_name = var.resource_group_name
  location            = var.region
  sku                 = "Standard"
  admin_enabled       = true
  tags                = var.tags
}
