variable "region" {}

variable "rds_identifier" {}

variable "db_engine" {}

variable "db_username" {}

variable "db_password" {}

variable "initial_db_name" {
  default = ""
}

variable "vpc_id" {}

variable "db_port" {
  default = 5432
}

variable "zone_name" {
  description = "Landing zone name"
  type        = string
}

variable "create_db" {
  type    = bool
  default = false
}

variable "subnet_ids" {
  type = list(string)
}