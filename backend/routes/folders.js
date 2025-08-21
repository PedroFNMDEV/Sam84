const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const SSHManager = require('../config/SSHManager');
const VideoURLBuilder = require('../config/VideoURLBuilder');

const router = express.Router();

// GET /api/folders - Lista pastas do usuário
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userLogin = req.user.usuario || req.user.email?.split('@')[0] || `user_${userId}`;

    // Buscar servidor do usuário
    const [serverRows] = await db.execute(
      'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
      [userId]
    );

    const serverId = serverRows.length > 0 ? serverRows[0].codigo_servidor : 1;

    try {
      // Listar pastas diretamente do servidor via SSH
      const userBasePath = `/home/streaming/${userLogin}`;
      const listCommand = `find "${userBasePath}" -maxdepth 1 -type d ! -path "${userBasePath}" -printf "%f\n" 2>/dev/null || echo "NO_FOLDERS"`;
      
      const result = await SSHManager.executeCommand(serverId, listCommand);
      
      let folders = [];
      
      if (!result.stdout.includes('NO_FOLDERS')) {
        const folderNames = result.stdout.split('\n').filter(name => name.trim() && name !== 'recordings' && name !== 'logos');
        
        folders = folderNames.map((name, index) => ({
          id: `folder_${name}_${index}`,
          nome: name.trim(),
          path: `${userBasePath}/${name.trim()}`,
          servidor_id: serverId,
          type: 'directory'
        }));
      }
      
      // Se não houver pastas, retornar pasta padrão
      if (folders.length === 0) {
        folders = [{
          id: `folder_default_0`,
          nome: 'default',
          path: `${userBasePath}/default`,
          servidor_id: serverId,
          type: 'directory'
        }];
      }
      
      console.log(`📁 Encontradas ${folders.length} pasta(s) para usuário ${userLogin}`);
      res.json(folders);
      
    } catch (sshError) {
      console.error('Erro ao listar pastas via SSH:', sshError);
      
      // Fallback: retornar pasta padrão
      res.json([{
        id: `folder_default_0`,
        nome: 'default',
        path: `/home/streaming/${userLogin}/default`,
        servidor_id: serverId,
        type: 'directory',
        error: 'Erro ao acessar servidor'
      }]);
    }
  } catch (err) {
    console.error('Erro ao buscar pastas:', err);
    res.status(500).json({ error: 'Erro ao buscar pastas', details: err.message });
  }
});

// POST /api/folders - Cria nova pasta
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
    
    const userId = req.user.id;
    const userLogin = req.user.usuario || req.user.email?.split('@')[0] || `user_${userId}`;
    
    // Sanitizar nome da pasta automaticamente
    const sanitizedName = VideoURLBuilder.sanitizeFolderName(nome);
    
    if (sanitizedName !== nome.toLowerCase()) {
      console.log(`📝 Nome da pasta sanitizado: "${nome}" -> "${sanitizedName}"`);
    }

    // Usar servidor padrão (ID 1) para todas as operações
    const serverId = 1;
    
    // Verificar se pasta já existe no sistema de arquivos (criar tabela folders se não existir)
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS folders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          nome VARCHAR(255) NOT NULL,
          nome_sanitizado VARCHAR(255) NOT NULL,
          caminho_servidor VARCHAR(500) NOT NULL,
          servidor_id INT DEFAULT 1,
          espaco_usado INT DEFAULT 0,
          data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status TINYINT(1) DEFAULT 1,
          UNIQUE KEY unique_user_folder (user_id, nome_sanitizado),

    try {
      // Garantir que estrutura completa do usuário existe
      await SSHManager.createCompleteUserStructure(serverId, userLogin, {
        bitrate: req.user.bitrate || 2500,
        espectadores: req.user.espectadores || 100,
        status_gravando: 'nao'
      });
      
      // Criar a pasta específica no servidor via SSH no caminho correto
      await SSHManager.createUserFolder(serverId, userLogin, sanitizedName);
      
      console.log(\`✅ Pasta ${sanitizedName} criada no servidor para usuário ${userLogin}`);

    } catch (sshError) {
      console.error('Erro ao criar pasta no servidor:', sshError);
      return res.status(500).json({ 
        error: 'Erro ao criar pasta no servidor',
        details: sshError.message 
      });
    }

    res.status(201).json({
      id: \`folder_${sanitizedName}_${Date.now()}`, // ID único para a pasta
      nome: sanitizedName,
      original_name: nome,
      sanitized: sanitizedName !== nome.toLowerCase(),
      path: folderPath,
      servidor_id: serverId,
      message: 'Pasta criada com sucesso no servidor'
    });
  } catch (err) {
    console.error('Erro ao criar pasta:', err);
    res.status(500).json({ error: 'Erro ao criar pasta', details: err.message });
  }
});

// PUT /api/folders/:id - Edita pasta
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const folderIdParam = req.params.id;
    const { nome } = req.body;
    const userId = req.user.id;
    const userLogin = req.user.usuario || req.user.email?.split('@')[0] || \`user_${userId}`;

    if (!nome) {
      return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
    }
    
    // Sanitizar nome da pasta automaticamente
    const sanitizedName = VideoURLBuilder.sanitizeFolderName(nome);
    
    if (sanitizedName !== nome.toLowerCase()) {
      console.log(\`📝 Nome da pasta sanitizado: "${nome}" -> "${sanitizedName}"`);
    }

    // Extrair nome da pasta atual do ID
    const oldFolderName = folderIdParam.includes('folder_') ? 
      folderIdParam.split('folder_')[1].split('_')[0] : 
      folderIdParam;

    // Buscar servidor do usuário
    const [serverRows] = await db.execute(
      'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
      [userId]
    );

    const serverId = serverRows.length > 0 ? serverRows[0].codigo_servidor : 1;

    try {
      // Renomear pasta no servidor via SSH
      const oldPath = `/home/streaming/${userLogin}/${oldFolderName}`;
      )
      const newPath = `/home/streaming/${userLogin}/${sanitizedName}`;
      
      // Verificar se pasta antiga existe
      const checkCommand = `test -d "${oldPath}" && echo "EXISTS" || echo "NOT_EXISTS"`;
      const checkResult = await SSHManager.executeCommand(serverId, checkCommand);
      
      if (checkResult.stdout.includes('EXISTS')) {
        // Renomear pasta
        await SSHManager.executeCommand(serverId, `mv "${oldPath}" "${newPath}"`);
        
        // Definir permissões corretas
        await SSHManager.executeCommand(serverId, `chmod -R 755 "${newPath}"`);
        await SSHManager.executeCommand(serverId, `chown -R streaming:streaming "${newPath}"`);
        
        console.log(`✅ Pasta renomeada no servidor: ${oldFolderName} -> ${sanitizedName}`);
      } else {
        // Se pasta não existe no servidor, criar nova
        await SSHManager.createUserFolder(serverId, userLogin, sanitizedName);
        console.log(`✅ Nova pasta criada no servidor: ${sanitizedName}`);
      }
      
    } catch (sshError) {
      console.error('Erro ao renomear pasta no servidor:', sshError);
      return res.status(500).json({ 
        error: 'Erro ao renomear pasta no servidor',
        details: sshError.message 
      });
    }

    // Atualizar caminhos dos vídeos no banco que referenciam esta pasta
    try {
      await db.execute(
        `UPDATE videos SET 
         url = REPLACE(url, '${userLogin}/${oldFolderName}/', '${userLogin}/${sanitizedName}/'),
         caminho = REPLACE(caminho, '/${oldFolderName}/', '/${sanitizedName}/')
         WHERE codigo_cliente = ? AND (url LIKE ? OR caminho LIKE ?)`,
        [userId, `%${userLogin}/${oldFolderName}/%`, `%/${oldFolderName}/%`]
      );
      
      console.log(`✅ Caminhos de vídeos atualizados: ${oldFolderName} -> ${sanitizedName}`);
    } catch (updateError) {
      console.warn('Aviso: Erro ao atualizar caminhos dos vídeos:', updateError.message);
    }

    res.json({ 
      success: true, 
      message: `Pasta renomeada com sucesso${sanitizedName !== nome.toLowerCase() ? ' (nome sanitizado)' : ''}`,
      old_name: oldFolderName,
      new_name: sanitizedName,
      original_name: nome,
      sanitized: sanitizedName !== nome.toLowerCase(),
      path: `/home/streaming/${userLogin}/${sanitizedName}`
    });
  } catch (err) {
    console.error('Erro ao editar pasta:', err);
    res.status(500).json({ error: 'Erro ao editar pasta', details: err.message });
  }
});

// DELETE /api/folders/:id - Remove pasta
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const folderIdParam = req.params.id;
    const userId = req.user.id;
    const userLogin = req.user.usuario || (req.user.email ? req.user.email.split('@')[0] : `user_${userId}`);

    // Extrair nome da pasta do ID
    const folderName = folderIdParam.includes('folder_') ? 
      folderIdParam.split('folder_')[1].split('_')[0] : 
      folderIdParam;

    // Buscar servidor do usuário
    const [serverRows] = await db.execute(
      'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
      [userId]
    );

    const serverId = serverRows.length > 0 ? serverRows[0].codigo_servidor : 1;

    // Verificar se há vídeos na pasta
    try {
      const [videoCountRows] = await db.execute(
        'SELECT COUNT(*) as count FROM videos WHERE codigo_cliente = ? AND (url LIKE ? OR caminho LIKE ?)',
        [userId, `%${userLogin}/${folderName}/%`, `%/${folderName}/%`]
      );

      if (videoCountRows[0].count > 0) {
        return res.status(400).json({ 
          error: 'Não é possível excluir pasta que contém vídeos',
          details: `A pasta contém ${videoCountRows[0].count} vídeo(s). Remova todos os vídeos antes de excluir a pasta.`
        });
      }
    } catch (videoCheckError) {
      console.warn('Aviso: Erro ao verificar vídeos na pasta:', videoCheckError.message);
    }

    try {
      // Remover pasta do servidor via SSH
      const remoteFolderPath = `/home/streaming/${userLogin}/${folderName}`;
      
      // Verificar se pasta existe no servidor
      const checkCommand = `test -d "${remoteFolderPath}" && echo "EXISTS" || echo "NOT_EXISTS"`;
      const checkResult = await SSHManager.executeCommand(serverId, checkCommand);
      
      if (checkResult.stdout.includes('EXISTS')) {
        // Verificar se pasta está realmente vazia no servidor
        const listCommand = `find "${remoteFolderPath}" -type f | wc -l`;
        const listResult = await SSHManager.executeCommand(serverId, listCommand);
        const fileCount = parseInt(listResult.stdout.trim()) || 0;
        
        if (fileCount > 0) {
          return res.status(400).json({ 
            error: 'Pasta contém arquivos no servidor',
            details: `Encontrados ${fileCount} arquivo(s) no servidor. Remova-os primeiro.`
          });
        }
        
        // Remover pasta vazia
        await SSHManager.executeCommand(serverId, `rmdir "${remoteFolderPath}"`);
        console.log(`✅ Pasta ${folderName} removida do servidor`);
      } else {
        console.log(`⚠️ Pasta ${folderName} não existe no servidor, removendo apenas do banco`);
      }
    } catch (sshError) {
      console.error('Erro ao remover pasta do servidor:', sshError.message);
      return res.status(500).json({ 
        error: 'Erro ao remover pasta do servidor',
        details: sshError.message 
      });
    }

    // Limpar referências de vídeos que apontam para esta pasta
    try {
      await db.execute(
        'DELETE FROM videos WHERE codigo_cliente = ? AND (url LIKE ? OR caminho LIKE ?)',
        [userId, `%${userLogin}/${folderName}/%`, `%/${folderName}/%`]
      );
      
      console.log(`✅ Referências de vídeos da pasta ${folderName} removidas`);
    } catch (cleanupError) {
      console.warn('Aviso: Erro ao limpar referências de vídeos:', cleanupError.message);
    }

    res.json({ success: true, message: 'Pasta removida com sucesso' });
  } catch (err) {
    console.error('Erro ao remover pasta:', err);
    res.status(500).json({ error: 'Erro ao remover pasta', details: err.message });
  }
});

// GET /api/folders/:id/info - Informações detalhadas da pasta
router.get('/:id/info', authMiddleware, async (req, res) => {
  try {
    const folderIdParam = req.params.id;
    const userId = req.user.id;
    const userLogin = req.user.email ? req.user.email.split('@')[0] : `user_${userId}`;

    // Extrair nome da pasta do ID
    const folderName = folderIdParam.includes('folder_') ? 
      folderIdParam.split('folder_')[1].split('_')[0] : 
      folderIdParam;

    // Buscar servidor do usuário
    const [serverRows] = await db.execute(
      'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
      [userId]
    );

    const serverId = serverRows.length > 0 ? serverRows[0].codigo_servidor : 1;

    // Calcular espaço usado baseado nos vídeos que referenciam esta pasta
    const [videoSizeRows] = await db.execute(
      `SELECT COALESCE(SUM(CEIL(tamanho_arquivo / (1024 * 1024))), 0) as real_used_mb
       FROM videos 
       WHERE codigo_cliente = ? AND (url LIKE ? OR caminho LIKE ?)`,
      [userId, `%${userLogin}/${folderName}/%`, `%/${folderName}/%`]
    );
    
    const realUsedMB = videoSizeRows[0]?.real_used_mb || 0;
    
    // Verificar se pasta existe no servidor
    let serverInfo = null;
    try {
      const remoteFolderPath = `/home/streaming/${userLogin}/${folderName}`;
      const checkCommand = `test -d "${remoteFolderPath}" && ls -la "${remoteFolderPath}" | head -1 || echo "NOT_EXISTS"`;
      const checkResult = await SSHManager.executeCommand(serverId, checkCommand);
      
      if (!checkResult.stdout.includes('NOT_EXISTS')) {
        // Contar arquivos na pasta
        const countCommand = `find "${remoteFolderPath}" -type f | wc -l`;
        const countResult = await SSHManager.executeCommand(serverId, countCommand);
        const fileCount = parseInt(countResult.stdout.trim()) || 0;
        
        // Calcular tamanho da pasta
        const sizeCommand = `du -sb "${remoteFolderPath}" 2>/dev/null | cut -f1 || echo "0"`;
        const sizeResult = await SSHManager.executeCommand(serverId, sizeCommand);
        const folderSize = parseInt(sizeResult.stdout.trim()) || 0;
        
        serverInfo = {
          exists: true,
          file_count: fileCount,
          size_bytes: folderSize,
          size_mb: Math.ceil(folderSize / (1024 * 1024)),
          path: remoteFolderPath
        };
      } else {
        serverInfo = {
          exists: false,
          file_count: 0,
          size_bytes: 0,
          size_mb: 0,
          path: remoteFolderPath
        };
      }
    } catch (sshError) {
      console.warn('Erro ao verificar pasta no servidor:', sshError.message);
      serverInfo = {
        exists: false,
        error: sshError.message
      };
    }

    // Contar vídeos no banco
    const [videoCountRows] = await db.execute(
      'SELECT COUNT(*) as count FROM videos WHERE codigo_cliente = ? AND (url LIKE ? OR caminho LIKE ?)',
      [userId, `%${userLogin}/${folderName}/%`, `%/${folderName}/%`]
    );

    res.json({
      id: folderIdParam,
      nome: folderName,
      path: `/home/streaming/${userLogin}/${folderName}`,
      servidor_id: serverId,
      video_count_db: videoCountRows[0].count,
      server_info: serverInfo,
      real_used_mb: realUsedMB,
      espaco_usado: Math.max(serverInfo?.size_mb || 0, realUsedMB),
      percentage_used: realUsedMB > 0 ? Math.round((realUsedMB / 1000) * 100) : 0 // Assumindo 1GB como padrão
    });
  } catch (err) {
    console.error('Erro ao buscar informações da pasta:', err);
    res.status(500).json({ error: 'Erro ao buscar informações da pasta', details: err.message });
  }
});

// POST /api/folders/:id/sync - Sincronizar pasta com servidor
router.post('/:id/sync', authMiddleware, async (req, res) => {
  try {
    const folderIdParam = req.params.id;
    const userId = req.user.id;
    const userLogin = req.user.usuario || `user_${userId}`;

    // Extrair nome da pasta do ID
    const folderName = folderIdParam.includes('folder_') ? 
      folderIdParam.split('folder_')[1].split('_')[0] : 
      folderIdParam;

    // Buscar servidor do usuário
    const [serverRows] = await db.execute(
      'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
      [userId]
    );

    const serverId = serverRows.length > 0 ? serverRows[0].codigo_servidor : 1;

    try {
      // Garantir que estrutura completa do usuário existe
      await SSHManager.createCompleteUserStructure(serverId, userLogin, {
        bitrate: req.user.bitrate || 2500,
        espectadores: req.user.espectadores || 100,
        status_gravando: 'nao'
      });
      
      // Garantir que pasta específica existe
      await SSHManager.createUserFolder(serverId, userLogin, folderName);
      
      // Limpar arquivos temporários e corrompidos
      const cleanupCommand = `find "/home/streaming/${userLogin}/${folderName}" -type f \\( -name "*.tmp" -o -name "*.part" -o -size 0 \\) -delete 2>/dev/null || true`;
      await SSHManager.executeCommand(serverId, cleanupCommand);
      
      // Definir permissões corretas
      const folderPath = `/home/streaming/${userLogin}/${folderName}`;
      await SSHManager.executeCommand(serverId, `chmod -R 755 "${folderPath}"`);
      await SSHManager.executeCommand(serverId, `chown -R streaming:streaming "${folderPath}"`);
      
      console.log(`✅ Pasta ${folderName} sincronizada com servidor`);
      
      res.json({
        success: true,
        message: 'Pasta sincronizada com sucesso',
        folder_name: folderName,
        server_path: folderPath
      });
    } catch (sshError) {
      console.error('Erro na sincronização:', sshError);
      res.status(500).json({ 
        error: 'Erro ao sincronizar pasta com servidor',
        details: sshError.message 
      });
    }
  } catch (err) {
    console.error('Erro na sincronização da pasta:', err);
    res.status(500).json({ error: 'Erro na sincronização da pasta', details: err.message });
  }
});

module.exports = router;= router;Error);
      res.status(500).json({ 
        error: 'Erro ao sincronizar pasta com servidor',
        details: sshError.message 
      });
    }
  } catch (err) {
    console.error('Erro na sincronização da pasta:', err);
    res.status(500).json({ error: 'Erro na sincronização da pasta', details: err.message });
  }
});

module.exports = router;