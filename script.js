
    
  //  let qrGenerated = false;
    
    let imgBox = document.getElementById("imgBox");
    let qrImage = document.getElementById("qrImage");
    let qrText = document.getElementById("qrText");
    let loading = document.getElementById("loading");
    let qrSize = document.getElementById("qrSize");
    
    
    /*
    script to handle auto generate on typing 
    */
    
   /* 
   let typingTimer;

qrText.addEventListener("input", function(){
 if(qrText.value.length === 0){
    imgBox.classList.remove("show-img");
}
    clearTimeout(typingTimer);

    typingTimer = setTimeout(function(){
        if(qrText.value.length > 0){
            generateQR();
        }
    }, 500);

});

 */
 qrImage.onload = function(){
    qrGenerated = true;
}

    // i have decided to be commenting my code in //chichewa cox no 
    
        function generateQR(){
            
            if(qrText.value.length >0){
                
                loading.classList.add("show-loading");
                
          qrImage.src= "https://quickchart.io/qr?size="
          + qrSize.value
          + "&text="
          + encodeURIComponent(qrText.value);
          + "&t=" + new Date().getTime();// force refreshing 
          
          qrText.addEventListener("input", function(){
    if(qrText.value.length > 0){
        generateQR();
    }
});
          
          
          qrImage.onload= function (){
             loading.classList.remove("show-loading");
            imgBox.classList.add("show-img");
              
          } 
          
            }else{
                qrText.classList.add("error");
                setTimeout(()=>{
                    qrText.classList.remove("error");
                },1000);
            }
            
        }
        
    //auto generate on enter key
    
        qrText.addEventListener("keyup", function(event){
    if(event.key === "Enter"){
        generateQR();
    }
});

//download QR image function

/*

function downloadQR(){

    if(qrImage.src !== ""){

        let link = document.createElement("a");
        link.href = qrImage.src;
        link.download = "QRCode.png";
        link.click();
        
       /*
       if (!qrGenerated) {
    showError("Please generate QR first");
    return;
} 

if (!qrImage.src.includes("quickchart.io")) {
    alert("Please generate a QR code first!");
    return;
}
  

    }
}
*/
let downloadMessage = document.getElementById("downloadMessage");

function downloadQR(){

    if (!qrImage.src || !qrImage.src.includes("quickchart.io")) {

        downloadMessage.textContent = "Please generate a QR code first.";
        downloadMessage.classList.add("show-message");
        
//removes the error message when user tries to download the qr code before it has been generated 


        setTimeout(() => {
            downloadMessage.classList.remove("show-message");
        }, 2000);

        return;
    }

    let link = document.createElement("a");
    link.href = qrImage.src;
    link.download = "QRCode.png";
    link.click();
   
}   
