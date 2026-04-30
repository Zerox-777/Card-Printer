let db;
let currentDeck={size:'J',cards:[],name:''};
const {jsPDF}=window.jspdf;

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
    currentDeck={id:Date.now().toString(),size:size,cards:[],name:''};
    document.getElementById('dashboard').style.display='none';
    document.getElementById('editor').style.display='block';
    document.getElementById('deck-name-input').value = "";
    renderGrid();
}

function goBack(){
    const confirmBack=confirm("You have unsaved changes. Are you sure you want to exit?");
    
    if(confirmBack){
        document.getElementById('editor').style.display='none';
        document.getElementById('dashboard').style.display='block';
        loadDeckList();
    }
}

function loadDeckList(){
    const listDiv=document.getElementById('deck-list');
    listDiv.innerHTML="";
    
    const store=db.transaction('decks','readonly').objectStore('decks');
    store.openCursor().onsuccess=(e)=>{
        const cursor=e.target.result;
        if(cursor){
            const deck=cursor.value;
            const item=document.createElement('div');
            item.className="deck-item";
            
            const symbol=deck.size==='J'? 
                '<span style="color:red;font-weight:bold">J</span>': 
                '<span style="color:blue;font-weight:bold">S</span>';

            item.innerHTML=`
                ${symbol} <strong>${deck.name}</strong>
                <div class="actions">
                    <button onclick="copyDeck('${deck.id}')">Copy</button>
                    <button onclick="editDeck('${deck.id}')">Edit</button>
                    <button onclick="deleteDeck('${deck.id}')">Delete</button>
                    <button onclick="printFromList('${deck.id}')">Print</button>
                </div>
            `;
            listDiv.appendChild(item);
            cursor.continue();
        }
    };
}

function editDeck(id){
    const store=db.transaction('decks','readonly').objectStore('decks');
    store.get(id).onsuccess=(e)=>{
        currentDeck=e.target.result;
        document.getElementById('dashboard').style.display='none';
        document.getElementById('editor').style.display='block';
        document.getElementById('deck-name-input').value = currentDeck.name || "";
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
    renderGrid();
    event.target.value=''; // Reset input
}

function renderGrid(){
    const grid=document.getElementById('card-grid');
    grid.innerHTML='';
    currentDeck.cards.forEach((card,index)=>{
        const div=document.createElement('div');
        div.className='card-item';
        div.innerHTML=`
            <img src="${card.url}">
            <br>
            <input type="number" min="1" value="${card.quantity}" onchange="updateQuantity(${index},this.value)">
            <button onclick="removeCard(${index})" style="color:red;margin-top:10px;cursor:pointer;">REMOVE</button>
        `;
        grid.appendChild(div);
    });
}
function updateDeckName(val) {
    currentDeck.name = val;
}

function updateQuantity(index,val){
    currentDeck.cards[index].quantity=parseInt(val);
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