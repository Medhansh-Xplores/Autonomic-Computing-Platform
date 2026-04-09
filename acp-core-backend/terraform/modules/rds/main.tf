# -----------------------------
# Security Group
# -----------------------------
resource "aws_security_group" "rds_sg" {
  name        = "${var.rds_identifier}-sg"
  description = "RDS Security Group"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = var.db_port
    to_port     = var.db_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
  CreatedBy = "Autonomic Computing Platform"
}
}

# -----------------------------
# Subnet Group
# -----------------------------
resource "aws_db_subnet_group" "rds_subnet" {
  name       = "${var.rds_identifier}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
  CreatedBy = "Autonomic Computing Platform"
}
}

# -----------------------------
# RDS Instance
# -----------------------------
resource "aws_db_instance" "rds" {

  identifier = var.rds_identifier

  engine     = var.db_engine
  port       = var.db_port

  instance_class    = "db.t3.micro"
  allocated_storage = 20

  username = var.db_username
  password = var.db_password

  db_name = var.initial_db_name

  db_subnet_group_name   = aws_db_subnet_group.rds_subnet.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]

  publicly_accessible = false
  skip_final_snapshot = true

  tags = {
  CreatedBy = "Autonomic Computing Platform"
}

}