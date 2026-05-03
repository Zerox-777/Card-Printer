let db;
const {jsPDF}=window.jspdf;
let isChanged=false;
let currentDeck=null;

// 1.KHỞI TẠO CƠ SỞ DỮ LIỆU INDEXEDDB
const request=indexedDB.open('CardMakerDB',1);

request.onupgradeneeded=(e)=>{
    db=e.target.result;
    if(!db.objectStoreNames.contains('decks')){
        db.createObjectStore('decks',{keyPath:'id'});
    }
};

request.onsuccess=(e)=>{
    db=e.target.result;
    loadDeckList();
};

// 2.QUẢN LÝ TRANG CHỦ (DASHBOARD)
function createDeck(size){
    // 1. Khởi tạo dữ liệu bộ bài mới
    currentDeck={
        id:Date.now().toString(),// Tạo ID duy nhất bằng thời gian
        name:"",
        size:size,// 'J' cho Japanese hoặc 'S' cho Standard
        cards:[]
    };
    isChanged=false; // Đặt lại trạng thái chưa thay đổi khi tạo mới
    document.getElementById('dashboard').style.display='none';
    document.getElementById('editor').style.display='block';
    const nameInput=document.getElementById('deck-name-input');
    if(nameInput){
        nameInput.value="";
        // Gán sự kiện input ngay khi tạo mới
        nameInput.oninput=function(e){
            currentDeck.name=e.target.value;
            isChanged=true;
        };
    }
    
    const stats=document.getElementById('deck-stats');
    if(stats) stats.innerText="Total Cards: 0";

    // 5. Vẽ lưới trống
    renderGrid();
}

function goBack(){
    if(!currentDeck){
        document.getElementById('editor').style.display='none';
        document.getElementById('dashboard').style.display='block';
        if(typeof loadDeckList==='function') loadDeckList();
        return;
    }
    if(isChanged){
        const confirmExit=confirm("You have unsaved changes. Are you sure you want to leave?");
        if(!confirmExit) return; // Nếu chọn Cancel thì ở lại
    }
    
    // Nếu không có thay đổi hoặc người dùng đồng ý thoát
    document.getElementById('editor').style.display='none';
    document.getElementById('dashboard').style.display='block';
    currentDeck=null;
    isChanged=false;
    if(typeof loadDeckList==='function') loadDeckList();
}

function loadDeckList(){
    const store=db.transaction('decks','readonly').objectStore('decks');
    const request=store.getAll();
    
    request.onsuccess=function(){
        const decks=request.result;
        const grid=document.getElementById('deck-list');
        const emptyState=document.getElementById('empty-state');
        
        grid.innerHTML=''; // Xóa nội dung cũ
        
        if(decks.length===0){
            // Nếu chưa có bài thì hiện trạng thái trống
            emptyState.style.display='block';
            grid.style.display='none';
        }else{
            // Nếu có bài thì ẩn trạng thái trống và hiện lưới
            emptyState.style.display='none';
            grid.style.display='grid';
            
            decks.forEach(deck=>{
                const item=document.createElement('div');
                item.className='deck-item';
                
                // Hiển thị loại bài cho chuyên nghiệp
                const isJapanese=deck.size==='J'||deck.type==='J';
                const symbol=deck.size==='J'?'Japanese':'Standard';
                const textColor=isJapanese?'#dc3545':'#007bff'; // Đỏ cho Japanese,Xanh cho Standard
                const bgColor=isJapanese?'#f8d7da':'#e7f1ff';
                const cardCount=deck.cards?deck.cards.reduce((sum,c)=>sum+c.quantity,0):0;
                
                item.innerHTML=`
                    <div style="margin-bottom: 10px;">
                        <h3 style="margin:0 0 10px 0;color:#333;font-size:1.2em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${deck.name||'Unnamed Deck'}
                        </h3>
                        <!-- Phần màu sắc đã được nhúng động qua biến textColor và bgColor -->
                        <span style="font-size:12px;color:${textColor};background:${bgColor};padding:4px 8px;border-radius:12px;font-weight:bold;">
                            ${symbol}
                        </span>
                        <span style="font-size: 12px; color: #666; margin-left: 10px;">
                            🎴 Cards: ${cardCount}
                        </span>
                    </div>
                    <div class="actions">
                        <button class="btn-secondary" onclick="copyDeck('${deck.id}')">Copy</button>
                        <button class="btn-primary" onclick="editDeck('${deck.id}')">Edit</button>
                        <button class="btn-danger" onclick="deleteDeck('${deck.id}')">Delete</button>
                        <button class="btn-success" onclick="printFromList('${deck.id}')">Print</button>
                    </div>
                `;
                grid.appendChild(item);
            });
        }
    };
}

function editDeck(id){
    const store=db.transaction('decks','readonly').objectStore('decks');
    store.get(id).onsuccess=(e)=>{
        currentDeck=e.target.result;
        isChanged = false; // Đặt lại trạng thái chưa thay đổi khi tải bộ bài   
        document.getElementById('dashboard').style.display='none';
        document.getElementById('editor').style.display='block';
        document.getElementById('deck-name-input').value = currentDeck.name || "";
        document.getElementById('deck-name-input').oninput = function(e){
        currentDeck.name = e.target.value;
        isChanged = true; // Đánh dấu có thay đổi để hiện cảnh báo khi thoát
        };
        renderGrid();
    };
}

function copyDeck(id){
    const store=db.transaction('decks','readonly').objectStore('decks');
    store.get(id).onsuccess=(e)=>{
        const newDeck={...e.target.result,id:Date.now().toString(),name:e.target.result.name+" (Copy)"};
        const writeStore=db.transaction('decks','readwrite').objectStore('decks');
        writeStore.add(newDeck).onsuccess=()=>loadDeckList();
    };
}

function deleteDeck(id){
    if(confirm("Are you sure you want to delete this?")){
        const store=db.transaction('decks','readwrite').objectStore('decks');
        store.delete(id).onsuccess=()=>loadDeckList();
    }
}

// 3.QUẢN LÝ TRÌNH BIÊN TẬP (EDITOR)
// Hàm chuyển ảnh thành chuỗi Base64 để lưu trữ vĩnh viễn
function fileToBase64(file){
    return new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.readAsDataURL(file);
        reader.onload=()=>resolve(reader.result);
        reader.onerror=(error)=>reject(error);
    });
}

async function handleUpload(event){
    const files=event.target.files;
    for(let file of files){
        const base64Url=await fileToBase64(file);
        currentDeck.cards.push({url:base64Url,quantity:1});
    }
    isChanged = true;
    renderGrid();
    event.target.value=''; // Reset input
}

function renderGrid(){
    const grid=document.getElementById('card-grid');
    const stats=document.getElementById('deck-stats');
    grid.innerHTML='';
    
    let totalCards=0; // Biến lưu tổng số bài
    
    currentDeck.cards.forEach((card,index)=>{
        // Cộng dồn số lượng
        totalCards+=parseInt(card.quantity);
        
        const div=document.createElement('div');
        div.className='card-item';
        div.innerHTML=`
            <img src="${card.url}">
            <div class="quantity-control">
                <label>No.</label>
                <input type="number" min="1" value="${card.quantity}" onchange="updateQuantity(${index},this.value)">
            </div>
            <button class="btn-danger" onclick="removeCard(${index})" style="width:100%;">🗑️ Remove</button>
        `;
        grid.appendChild(div);
    });
    stats.textContent = `Total Cards: ${totalCards}`;
}
function updateDeckName(val) {
    currentDeck.name = val;
}

function updateQuantity(index,val){
    currentDeck.cards[index].quantity=parseInt(val);
    isChanged = true; // Bật lên lại
    renderGrid();
}

function removeCard(index){
    const confirmRemove = confirm("Are you sure you want to remove this card?");
    if (confirmRemove) {
        currentDeck.cards.splice(index,1);
        isChanged = true; // Đánh dấu có thay đổi để cảnh báo khi thoát
        renderGrid();
    }
}

async function saveDeck() {
    // Nếu chưa nhập tên ở ô Input thì mới hiện prompt hỏi
    if (!currentDeck.name || currentDeck.name.trim() === "") {
        const deckName = prompt("Enter deck name: ",currentDeck.name || "");
        if (!deckName) return false;
        currentDeck.name = deckName;
        document.getElementById('deck-name-input').value = deckName;
    }

    const transaction = db.transaction(['decks'],'readwrite');
    const store = transaction.objectStore('decks');
    store.put(currentDeck);

    return new Promise((resolve) => {
        transaction.oncomplete = () => {
            isChanged = false;
            alert("Successfully saved!");
            resolve(true);
        };
    });
}
function triggerUpload() {
    // Khi nhấn nút, nó sẽ giả lập cú click chuột vào ô input file đang bị ẩn
    document.getElementById('upload').click();
}

// 4.XỬ LÝ XUẤT FILE PDF
async function printPDF(){
    const saved=await saveDeck();
    if(!saved) return;
    await generatePDF(currentDeck);
    isChanged = false;
}

function printFromList(id){
    const store=db.transaction('decks','readonly').objectStore('decks');
    store.get(id).onsuccess=async (e)=>{
        const deckToPrint=e.target.result;
        if(deckToPrint){
            await generatePDF(deckToPrint);
        }
    };
}

async function generatePDF(deck){
    const pdf=new jsPDF('p','mm','a4');
    let cardWidth=deck.size==='J'?59:63;
    let cardHeight=deck.size==='J'?86:88;
    let marginLeft=deck.size==='J'?16.5:10.5;
    let marginTop=deck.size==='J'?19.5:16.5;

    let printList=[];
    deck.cards.forEach(card=>{
        for(let i=0;i<card.quantity;i++){
            printList.push(card.url);
        }
    });

    if(printList.length===0){
        alert("No cards to print!");
        return;
    }

    for(let i=0;i<printList.length;i++){
        let col=i%3;
        let row=Math.floor((i%9)/3);
        let x=marginLeft+(col*cardWidth);
        let y=marginTop+(row*cardHeight);

        let img=new Image();
        img.src=printList[i];
        
        await new Promise((resolve)=>{
            img.onload=()=>{
                pdf.addImage(img,'JPEG',x,y,cardWidth,cardHeight);
                resolve();
            };
        });

        // Sang trang nếu đủ 9 lá và chưa phải lá cuối
        if((i+1)%9===0&&i!==printList.length-1){
            pdf.addPage();
        }
    }
    
    pdf.save(`${deck.name}.pdf`);
}