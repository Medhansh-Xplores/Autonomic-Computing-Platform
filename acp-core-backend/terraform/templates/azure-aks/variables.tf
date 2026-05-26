variable "region" {
  description = "Azure region to deploy into"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
}

variable "cluster_name" {
  description = "AKS cluster name"
  type        = string
}

variable "dns_prefix" {
  description = "AKS DNS prefix"
  type        = string
}

variable "kubernetes_version" {
  description = "Optional AKS Kubernetes version"
  type        = string
  default     = null
}

variable "node_count" {
  description = "System node pool count"
  type        = number
  default     = 1
}

variable "vm_size" {
  description = "System node pool VM size"
  type        = string
  default     = "Standard_B2s"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
