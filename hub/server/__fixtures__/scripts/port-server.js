import net from 'node:net';

const PORT = Number(process.env.PORT || process.argv[2]);
const server = net.createServer();
server.on('error', (e) => { console.error('ERR', e.code); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => console.log('listening', PORT));

// 模拟真实优雅关闭：收到 SIGTERM 后延迟 250ms 才真正释放端口退出
process.on('SIGTERM', () => {
  setTimeout(() => { server.close(); process.exit(0); }, 250);
});
