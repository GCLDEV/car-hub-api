# Script de deployment direto para AWS EC2 via SSH/SCP (PowerShell)
# Execute com: .\deploy-direct-aws.ps1

param(
    [string]$SSHKey = "api-car-hub.pem",
    [string]$AppName = "car-hub-api",
    [string]$ImageTag = "latest"
)

# Configurações
$EC2_HOST = "ubuntu@ec2-3-235-79-223.compute-1.amazonaws.com"
$CONTAINER_NAME = "car-hub-api-container"
$REMOTE_DIR = "/home/ubuntu/car-hub-deploy"

# Cores para output
function Write-ColoredText {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

# Função para verificar e iniciar Docker
function Start-DockerIfNeeded {
    Write-ColoredText "🔍 Verificando status do Docker..." "Yellow"
    
    # Tentar um comando simples do Docker
    try {
        $null = docker version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredText "✅ Docker está rodando!" "Green"
            return $true
        }
    } catch {
        # Docker não está respondendo
    }
    
    Write-ColoredText "❌ Docker não está rodando. Tentando iniciar..." "Red"
    
    # Tentar encontrar Docker Desktop
    $dockerDesktopPaths = @(
        "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "${env:LOCALAPPDATA}\Programs\Docker\Docker\Docker Desktop.exe"
    )
    
    $dockerDesktopPath = $null
    foreach ($path in $dockerDesktopPaths) {
        if (Test-Path $path) {
            $dockerDesktopPath = $path
            break
        }
    }
    
    if ($dockerDesktopPath) {
        Write-ColoredText "🐳 Iniciando Docker Desktop..." "Yellow"
        Start-Process "$dockerDesktopPath" -WindowStyle Hidden
        
        Write-ColoredText "⏳ Aguardando Docker Desktop iniciar (isso pode levar 1-2 minutos)..." "Yellow"
        
        # Aguardar até 120 segundos para o Docker iniciar
        $timeout = 120
        $elapsed = 0
        
        while ($elapsed -lt $timeout) {
            Start-Sleep -Seconds 5
            $elapsed += 5
            
            try {
                $null = docker version 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-ColoredText "✅ Docker iniciado com sucesso!" "Green"
                    return $true
                }
            } catch {
                # Continuar aguardando
            }
            
            Write-Progress -Activity "Iniciando Docker" -Status "Aguardando... ($elapsed/$timeout segundos)" -PercentComplete (($elapsed / $timeout) * 100)
        }
        
        Write-Progress -Activity "Iniciando Docker" -Completed
        Write-ColoredText "❌ Timeout: Docker não iniciou dentro do tempo esperado" "Red"
        return $false
    } else {
        Write-ColoredText "❌ Docker Desktop não encontrado!" "Red"
        Write-ColoredText "💡 Instale o Docker Desktop de: https://docs.docker.com/desktop/windows/install/" "Yellow"
        return $false
    }
}

Write-ColoredText "🚀 Iniciando deployment do Car Hub API para AWS EC2..." "Blue"

# Verificar se Docker está rodando e iniciar se necessário
if (!(Start-DockerIfNeeded)) {
    Write-ColoredText "❌ Não foi possível iniciar o Docker. Deployment cancelado." "Red"
    Write-ColoredText "💡 Soluções:" "Yellow"
    Write-ColoredText "   1. Abra Docker Desktop manualmente" "White"
    Write-ColoredText "   2. Aguarde alguns minutos e execute novamente" "White"
    Write-ColoredText "   3. Reinicie o computador se necessário" "White"
    exit 1
}

# Verificar se a chave SSH existe
if (!(Test-Path $SSHKey)) {
    Write-ColoredText "❌ Arquivo de chave SSH não encontrado: $SSHKey" "Red"
    Write-ColoredText "💡 Certifique-se de que o arquivo api-car-hub.pem está no diretório atual" "Yellow"
    exit 1
}

# Verificar se Docker está instalado
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-ColoredText "❌ Docker não está instalado ou não está no PATH" "Red"
    exit 1
}

# Verificar se SSH está disponível
if (!(Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-ColoredText "❌ SSH não está disponível." "Red"
    Write-ColoredText "💡 Soluções:" "Yellow"
    Write-ColoredText "   1. Instale OpenSSH: 'Add-WindowsCapability -Online -Name OpenSSH.Client'" "White"
    Write-ColoredText "   2. Use WSL (Windows Subsystem for Linux)" "White"
    Write-ColoredText "   3. Use Git Bash" "White"
    exit 1
}

Write-ColoredText "📦 Fazendo build da imagem Docker..." "Yellow"
docker build -t "${AppName}:${ImageTag}" --target production .
if ($LASTEXITCODE -ne 0) {
    Write-ColoredText "❌ Erro no build da imagem Docker" "Red"
    exit 1
}

Write-ColoredText "💾 Salvando imagem como arquivo tar..." "Yellow"
docker save -o "${AppName}-${ImageTag}.tar" "${AppName}:${ImageTag}"
if ($LASTEXITCODE -ne 0) {
    Write-ColoredText "❌ Erro ao salvar imagem Docker" "Red"
    exit 1
}

Write-ColoredText "📁 Criando diretório remoto..." "Yellow"
ssh -i $SSHKey -o StrictHostKeyChecking=no $EC2_HOST "sudo mkdir -p $REMOTE_DIR && sudo chown ubuntu:ubuntu $REMOTE_DIR"

Write-ColoredText "⬆️ Transferindo imagem Docker para EC2..." "Yellow"
scp -i $SSHKey -o StrictHostKeyChecking=no "${AppName}-${ImageTag}.tar" "${EC2_HOST}:${REMOTE_DIR}/"
if ($LASTEXITCODE -ne 0) {
    Write-ColoredText "❌ Erro ao transferir imagem" "Red"
    exit 1
}

Write-ColoredText "📄 Transferindo arquivo de ambiente..." "Yellow"
if (Test-Path ".env") {
    scp -i $SSHKey -o StrictHostKeyChecking=no ".env" "${EC2_HOST}:${REMOTE_DIR}/.env"
} else {
    Write-ColoredText "⚠️ Arquivo .env não encontrado. Criando configuração básica..." "Yellow"
    # Criar .env básico se não existir
    $basicEnv = @"
HOST=0.0.0.0
PORT=1337
APP_KEYS=app-key-1,app-key-2,app-key-3,app-key-4
API_TOKEN_SALT=your-api-token-salt
ADMIN_JWT_SECRET=your-admin-jwt-secret
TRANSFER_TOKEN_SALT=your-transfer-token-salt
JWT_SECRET=your-jwt-secret
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
NODE_ENV=production
"@
    $basicEnv | Out-File -FilePath ".env" -Encoding UTF8
    scp -i $SSHKey -o StrictHostKeyChecking=no ".env" "${EC2_HOST}:${REMOTE_DIR}/.env"
}

Write-ColoredText "🔧 Configurando ambiente na EC2..." "Yellow"

# Script remoto para execução na EC2
$RemoteScript = @"
# Atualizar sistema
sudo apt-get update -y

# Instalar Docker se não estiver instalado
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    sudo systemctl start docker
    sudo systemctl enable docker
    # Reiniciar sessão para aplicar grupo docker
    newgrp docker
fi

# Aguardar Docker iniciar
sleep 5

# Navegar para o diretório
cd $REMOTE_DIR

# Parar container anterior se existir
if [ `$(sudo docker ps -q -f name=$CONTAINER_NAME)` ]; then
    echo "🔄 Parando container anterior..."
    sudo docker stop $CONTAINER_NAME
fi

# Remover container anterior se existir
if [ `$(sudo docker ps -aq -f name=$CONTAINER_NAME)` ]; then
    echo "🗑️ Removendo container anterior..."
    sudo docker rm $CONTAINER_NAME
fi

# Carregar imagem Docker
echo "📦 Carregando imagem Docker..."
sudo docker load -i ${AppName}-${ImageTag}.tar

# Criar diretórios necessários
mkdir -p uploads data

# Rodar novo container
echo "🚀 Iniciando Car Hub API container..."
sudo docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p 80:1337 \
    -p 1337:1337 \
    -v $REMOTE_DIR/uploads:/app/public/uploads \
    -v $REMOTE_DIR/data:/app/.tmp \
    --env-file .env \
    -e NODE_ENV=production \
    -e HOST=0.0.0.0 \
    -e PORT=1337 \
    ${AppName}:${ImageTag}

# Aguardar container iniciar
echo "⏳ Aguardando container iniciar..."
sleep 15

# Verificar status
echo "📊 Status do container:"
sudo docker ps | grep $CONTAINER_NAME || echo "❌ Container não está rodando"

echo "📝 Logs do container:"
sudo docker logs $CONTAINER_NAME --tail 20

echo "🔥 Configuração do firewall..."
sudo ufw allow 80
sudo ufw allow 1337
"@

# Executar script remoto
ssh -i $SSHKey -o StrictHostKeyChecking=no $EC2_HOST $RemoteScript

Write-ColoredText "🧹 Limpando arquivos temporários locais..." "Yellow"
Remove-Item "${AppName}-${ImageTag}.tar" -ErrorAction SilentlyContinue

Write-ColoredText "✅ Deployment do Car Hub API concluído!" "Green"
Write-ColoredText "🌐 Sua API está disponível em:" "Blue"
Write-ColoredText "   http://3.235.79.223" "Green"
Write-ColoredText "   http://3.235.79.223:1337" "Green"
Write-ColoredText "   Admin: http://3.235.79.223:1337/admin" "Green"

Write-ColoredText "`n📋 Comandos úteis:" "Yellow"
Write-ColoredText "Ver logs: ssh -i $SSHKey $EC2_HOST 'sudo docker logs $CONTAINER_NAME'" "Blue"
Write-ColoredText "Ver status: ssh -i $SSHKey $EC2_HOST 'sudo docker ps'" "Blue"
Write-ColoredText "Parar API: ssh -i $SSHKey $EC2_HOST 'sudo docker stop $CONTAINER_NAME'" "Blue"
Write-ColoredText "Iniciar API: ssh -i $SSHKey $EC2_HOST 'sudo docker start $CONTAINER_NAME'" "Blue"
Write-ColoredText "Conectar via SSH: ssh -i $SSHKey $EC2_HOST" "Blue"

Write-ColoredText "`n🎉 Car Hub API deploy realizado com sucesso!" "Green"