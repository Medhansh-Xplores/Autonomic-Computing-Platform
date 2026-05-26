output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "server_id" {
  value = try(azurerm_postgresql_flexible_server.main[0].id, azurerm_mssql_server.main[0].id)
}

output "server_name" {
  value = try(azurerm_postgresql_flexible_server.main[0].name, azurerm_mssql_server.main[0].name)
}

output "fqdn" {
  value = try(azurerm_postgresql_flexible_server.main[0].fqdn, azurerm_mssql_server.main[0].fully_qualified_domain_name)
}
