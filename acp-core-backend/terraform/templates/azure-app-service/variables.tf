variable "region" {
  description = "Azure region to deploy into"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
}

variable "acr_name" {
  description = "Azure Container Registry name (alphanumeric only)"
  type        = string
}

variable "app_service_plan_name" {
  description = "App Service Plan name"
  type        = string
}

variable "app_service_name" {
  description = "App Service name"
  type        = string
}

variable "image" {
  description = "Container image"
  type        = string
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
}

variable "port" {
  description = "Container port"
  type        = number
  default     = 80
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
