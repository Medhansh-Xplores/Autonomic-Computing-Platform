variable "region" {
  description = "Azure region to deploy into"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
}

variable "server_identifier" {
  description = "Database server name"
  type        = string
}

variable "db_engine" {
  description = "Database engine: postgres or sqlserver"
  type        = string
  default     = "postgres"

  validation {
    condition     = contains(["postgres", "sqlserver"], var.db_engine)
    error_message = "db_engine must be postgres or sqlserver."
  }
}

variable "db_username" {
  description = "Database administrator username"
  type        = string
}

variable "db_password" {
  description = "Database administrator password"
  type        = string
  sensitive   = true
}

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "sku_name" {
  description = "PostgreSQL SKU"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "storage_mb" {
  description = "Storage in MB"
  type        = number
  default     = 32768
}

variable "mssql_database_sku" {
  description = "Azure SQL database SKU"
  type        = string
  default     = "Basic"
}

variable "zone" {
  description = "Availability zone"
  type        = string
  default     = "1"
}

variable "allowed_ip_start" {
  description = "Firewall start IP"
  type        = string
  default     = "0.0.0.0"
}

variable "allowed_ip_end" {
  description = "Firewall end IP"
  type        = string
  default     = "0.0.0.0"
}

variable "create_db" {
  description = "Whether to create an initial database"
  type        = bool
  default     = false
}

variable "initial_db_name" {
  description = "Initial database name"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
