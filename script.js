// Sistema de Controle de Empréstimos - Caio & Itallo
// Dados salvos em LocalStorage

// SENHA FIXA PARA EXCLUIR REGISTROS
const SENHA_EXCLUIR = "amigos123";

let emprestimos = [];
let idParaExcluir = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Definir data atual como padrão
    document.getElementById('data').valueAsDate = new Date();
    
    // Carregar dados do LocalStorage
    carregarDados();
    
    // Atualizar interface
    atualizarInterface();
    
    // Configurar eventos
    document.getElementById('form-emprestimo').addEventListener('submit', registrarEmprestimo);
    document.getElementById('btn-limpar').addEventListener('click', limparFormulario);
    document.getElementById('btn-exportar').addEventListener('click', exportarDados);
    document.getElementById('btn-importar').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', importarDados);
    document.getElementById('btn-limpar-tudo').addEventListener('click', mostrarModalLimparTudo);
    document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
    document.getElementById('btn-confirmar-senha').addEventListener('click', verificarSenha);
    
    // Fechar modal ao clicar fora
    document.getElementById('senha-modal').addEventListener('click', function(e) {
        if (e.target === this) fecharModal();
    });
    
    // Enter no campo de senha
    document.getElementById('senha-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            verificarSenha();
        }
    });
    
    // Mostrar informações iniciais
    mostrarToast('Sistema carregado!', 'info');
});

// Carregar dados do LocalStorage
function carregarDados() {
    try {
        const dadosSalvos = localStorage.getItem('emprestimosCaioItallo');
        if (dadosSalvos) {
            emprestimos = JSON.parse(dadosSalvos);
            console.log(`Carregados ${emprestimos.length} empréstimos`);
        }
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
        mostrarToast('Erro ao carregar dados locais', 'error');
    }
}

// Salvar dados no LocalStorage
function salvarDados() {
    try {
        localStorage.setItem('emprestimosCaioItallo', JSON.stringify(emprestimos));
        return true;
    } catch (e) {
        console.error('Erro ao salvar dados:', e);
        mostrarToast('Erro ao salvar dados', 'error');
        return false;
    }
}

// Atualizar interface completa
function atualizarInterface() {
    calcularResumo();
    atualizarHistorico();
}

// Calcular resumo
function calcularResumo() {
    let caioDeve = 0;
    let italloDeve = 0;
    let valorTotal = 0;
    
    emprestimos.forEach(emp => {
        valorTotal += emp.valor;
        
        if (emp.deQuem === 'caio-para-itallo') {
            // Caio emprestou para Itallo, então Itallo deve
            italloDeve += emp.valor;
        } else {
            // Itallo emprestou para Caio, então Caio deve
            caioDeve += emp.valor;
        }
    });
    
    const saldoFinal = italloDeve - caioDeve;
    
    // Atualizar resumo
    document.getElementById('caio-deve').textContent = formatarMoeda(caioDeve);
    document.getElementById('itallo-deve').textContent = formatarMoeda(italloDeve);
    document.getElementById('saldo-final').textContent = formatarMoeda(Math.abs(saldoFinal));
    
    // Cor do saldo final
    const saldoElement = document.getElementById('saldo-final');
    if (saldoFinal > 0) {
        saldoElement.className = 'resumo-valor positivo';
    } else if (saldoFinal < 0) {
        saldoElement.className = 'resumo-valor negativo';
    } else {
        saldoElement.className = 'resumo-valor';
    }
    
    // Atualizar estatísticas
    document.getElementById('total-emprestimos').textContent = `${emprestimos.length} empréstimo${emprestimos.length !== 1 ? 's' : ''}`;
    document.getElementById('valor-total').textContent = `Total: ${formatarMoeda(valorTotal)}`;
}

// Atualizar histórico
function atualizarHistorico() {
    const listaElement = document.getElementById('lista-emprestimos');
    const semDadosElement = document.getElementById('sem-dados');
    
    listaElement.innerHTML = '';
    
    if (emprestimos.length === 0) {
        semDadosElement.style.display = 'block';
        return;
    }
    
    semDadosElement.style.display = 'none';
    
    // Ordenar por data (mais recente primeiro)
    const emprestimosOrdenados = [...emprestimos].sort((a, b) => {
        return new Date(b.data) - new Date(a.data);
    });
    
    emprestimosOrdenados.forEach((emp, index) => {
        const div = document.createElement('div');
        div.className = `emprestimo-item ${emp.deQuem === 'caio-para-itallo' ? 'caio' : 'itallo'}`;
        
        // Formatar data
        const dataObj = new Date(emp.data);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR');
        
        // Determinar texto
        const quemEmprestou = emp.deQuem === 'caio-para-itallo' ? 'Caio' : 'Itallo';
        const paraQuem = emp.deQuem === 'caio-para-itallo' ? 'Itallo' : 'Caio';
        
        div.innerHTML = `
            <div class="emprestimo-header">
                <div class="emprestimo-pessoa ${quemEmprestou.toLowerCase()}">
                    <i class="fas fa-user-circle"></i> ${quemEmprestou} → ${paraQuem}
                </div>
                <div class="emprestimo-data">
                    <i class="far fa-calendar"></i> ${dataFormatada}
                </div>
            </div>
            <div class="emprestimo-valor">${formatarMoeda(emp.valor)}</div>
            ${emp.descricao ? `<div class="emprestimo-descricao"><i class="far fa-comment"></i> ${emp.descricao}</div>` : ''}
            <div class="emprestimo-acoes">
                <button class="btn-excluir" onclick="solicitarExclusao(${index})">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        `;
        
        listaElement.appendChild(div);
    });
}

// Registrar novo empréstimo
function registrarEmprestimo(event) {
    event.preventDefault();
    
    // Obter valores
    const deQuem = document.querySelector('input[name="de-quem"]:checked').value;
    const valor = parseFloat(document.getElementById('valor').value);
    const descricao = document.getElementById('descricao').value;
    const data = document.getElementById('data').value;
    
    // Validações
    if (!deQuem || !valor || !data) {
        mostrarToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    if (valor <= 0) {
        mostrarToast('O valor deve ser maior que zero', 'error');
        return;
    }
    
    // Criar empréstimo
    const emprestimo = {
        deQuem,
        valor,
        descricao,
        data,
        dataRegistro: new Date().toISOString()
    };
    
    // Adicionar
    emprestimos.push(emprestimo);
    
    // Salvar
    if (salvarDados()) {
        atualizarInterface();
        limparFormulario();
        mostrarToast('Empréstimo registrado com sucesso!', 'success');
    }
}

// Solicitar exclusão (abre modal de senha)
function solicitarExclusao(id) {
    idParaExcluir = id;
    
    // Resetar modal
    document.getElementById('senha-input').value = '';
    document.getElementById('senha-erro').textContent = '';
    document.getElementById('senha-erro').classList.remove('show');
    
    // Mostrar modal
    document.getElementById('senha-modal').style.display = 'flex';
    document.getElementById('senha-input').focus();
}

// Verificar senha
function verificarSenha() {
    const senhaDigitada = document.getElementById('senha-input').value;
    const erroElement = document.getElementById('senha-erro');
    
    if (senhaDigitada === SENHA_EXCLUIR) {
        // Senha correta - excluir
        excluirEmprestimo(idParaExcluir);
        fecharModal();
    } else {
        // Senha incorreta
        erroElement.textContent = 'Senha incorreta!';
        erroElement.classList.add('show');
        document.getElementById('senha-input').value = '';
        document.getElementById('senha-input').focus();
        
        // Vibrar o campo
        const input = document.getElementById('senha-input');
        input.style.borderColor = 'var(--danger-color)';
        input.style.animation = 'shake 0.5s';
        
        setTimeout(() => {
            input.style.borderColor = '';
            input.style.animation = '';
        }, 500);
    }
}

// Excluir empréstimo (após verificação de senha)
function excluirEmprestimo(id) {
    if (id !== null && id >= 0 && id < emprestimos.length) {
        emprestimos.splice(id, 1);
        
        if (salvarDados()) {
            atualizarInterface();
            mostrarToast('Empréstimo excluído com sucesso!', 'success');
        }
    }
    
    idParaExcluir = null;
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('form-emprestimo').reset();
    document.getElementById('data').valueAsDate = new Date();
}

// Exportar dados
function exportarDados() {
    if (emprestimos.length === 0) {
        mostrarToast('Não há dados para exportar', 'warning');
        return;
    }
    
    const dados = {
        sistema: 'Controle de Empréstimos Caio & Itallo',
        versao: '1.0',
        senhaExclusao: SENHA_EXCLUIR,
        dataExportacao: new Date().toISOString(),
        totalEmprestimos: emprestimos.length,
        emprestimos: emprestimos
    };
    
    const dadosStr = JSON.stringify(dados, null, 2);
    const blob = new Blob([dadosStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emprestimos-caio-itallo-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    mostrarToast('Dados exportados com sucesso!', 'success');
}

// Importar dados
function importarDados(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            
            if (!dados.emprestimos || !Array.isArray(dados.emprestimos)) {
                throw new Error('Formato de arquivo inválido');
            }
            
            // Verificar senha se existir no arquivo
            if (dados.senhaExclusao && dados.senhaExclusao !== SENHA_EXCLUIR) {
                mostrarToast('O arquivo foi exportado com uma senha diferente', 'warning');
            }
            
            // Substituir dados
            emprestimos = dados.emprestimos;
            
            if (salvarDados()) {
                atualizarInterface();
                mostrarToast(`${emprestimos.length} empréstimos importados com sucesso!`, 'success');
            }
            
        } catch (error) {
            console.error('Erro ao importar dados:', error);
            mostrarToast('Erro ao importar arquivo. Verifique o formato.', 'error');
        }
        
        // Limpar input file
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Mostrar modal para limpar tudo
function mostrarModalLimparTudo() {
    if (emprestimos.length === 0) {
        mostrarToast('Não há dados para limpar', 'warning');
        return;
    }
    
    // Abrir modal de senha para limpar tudo
    idParaExcluir = -1; // Usar -1 para indicar limpar tudo
    document.getElementById('senha-input').value = '';
    document.getElementById('senha-erro').textContent = '';
    document.getElementById('senha-erro').classList.remove('show');
    document.getElementById('senha-modal').style.display = 'flex';
    document.getElementById('senha-input').focus();
}

// Função para limpar todos os dados
function limparTodosDados() {
    emprestimos = [];
    
    if (salvarDados()) {
        atualizarInterface();
        mostrarToast('Todos os dados foram excluídos!', 'success');
    }
}

// Fechar modal
function fecharModal() {
    document.getElementById('senha-modal').style.display = 'none';
    idParaExcluir = null;
}

// Formatar moeda
function formatarMoeda(valor) {
    return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

// Mostrar toast
function mostrarToast(mensagem, tipo = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = 'toast show';
    
    // Cores baseadas no tipo
    const cores = {
        'success': '#27ae60',
        'error': '#e74c3c',
        'warning': '#f39c12',
        'info': '#3498db'
    };
    
    toast.style.backgroundColor = cores[tipo] || '#333';
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Adicionar animação shake
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);