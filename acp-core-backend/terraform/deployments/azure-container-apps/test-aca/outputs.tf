output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "container_app_environment_id" {
  value = azurerm_container_app_environment.main.id
}

output "container_app_id" {
  value = azurerm_container_app.main.id
}

output "container_app_name" {
  value = azurerm_container_app.main.name
}

output "fqdn" {
  value = azurerm_container_app.main.latest_revision_fqdn
}
