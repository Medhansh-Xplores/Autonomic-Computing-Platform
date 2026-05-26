output "rds_endpoint" {
  value = aws_db_instance.rds.endpoint
}

output "rds_identifier" {
  value = aws_db_instance.rds.id
}