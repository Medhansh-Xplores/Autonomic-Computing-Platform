variable "region" {
  description = "Azure region to deploy into"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
}

variable "container_app_name" {
  description = "Container app name"
  type        = string
}

variable "container_app_environment_name" {
  description = "Container app environment name"
  type        = string
}

variable "container_name" {
  description = "Container name"
  type        = string
  default     = "app"
}

variable "image" {
  description = "Container image"
  type        = string
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
}

variable "cpu" {
  description = "Container CPU"
  type        = number
}

variable "memory" {
  description = "Container memory in GB"
  type        = number
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
