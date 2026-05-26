output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public Subnet IDs"
  value = [
    aws_subnet.public_1.id,
    aws_subnet.public_2.id
  ]
}

output "private_subnet_ids" {
  description = "Private Subnet IDs"
  value = [
    aws_subnet.private_1.id,
    aws_subnet.private_2.id
  ]
}

output "internet_gateway_id" {
  description = "Internet Gateway ID"
  value       = aws_internet_gateway.igw.id
}

output "public_route_table_id" {
  description = "Public Route Table ID"
  value       = aws_route_table.public.id
}